import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { parseCSV, transformRows } from '@/lib/csv-parser'
import { reconcileBudgetCategories } from '@/lib/budget-utils'
import { createMonthlySnapshot } from '@/lib/snapshots'
import { inferCategoryGroup, classifyTransaction } from '@/lib/category-groups'
/** R1.5a: Infer account type from name (e.g., "Platinum Card" → CREDIT_CARD) */
function inferAccountType(name: string): 'CHECKING' | 'SAVINGS' | 'CREDIT_CARD' | 'INVESTMENT' | 'CASH' | 'MORTGAGE' | 'AUTO_LOAN' | 'STUDENT_LOAN' {
  const lower = name.toLowerCase()
  const CREDIT_CARD_PATTERNS = ['card', 'visa', 'mastercard', 'amex', 'discover', 'platinum', 'venture', 'sapphire', 'freedom', 'chase ']
  const SAVINGS_PATTERNS = ['saving', 'savings', 'money market', 'high yield', 'hysa']
  const MORTGAGE_PATTERNS = ['mortgage', 'home loan']
  const AUTO_PATTERNS = ['auto loan', 'car loan', 'vehicle']
  const STUDENT_PATTERNS = ['student loan', 'student']
  const INVESTMENT_PATTERNS = ['invest', 'brokerage', '401k', 'ira', 'roth', 'retirement']

  if (CREDIT_CARD_PATTERNS.some(p => lower.includes(p))) return 'CREDIT_CARD'
  if (SAVINGS_PATTERNS.some(p => lower.includes(p))) return 'SAVINGS'
  if (MORTGAGE_PATTERNS.some(p => lower.includes(p))) return 'MORTGAGE'
  if (AUTO_PATTERNS.some(p => lower.includes(p))) return 'AUTO_LOAN'
  if (STUDENT_PATTERNS.some(p => lower.includes(p))) return 'STUDENT_LOAN'
  if (INVESTMENT_PATTERNS.some(p => lower.includes(p))) return 'INVESTMENT'
  return 'CHECKING'
}

/** Keywords in CSV category names that indicate income */
const INCOME_CAT_KEYWORDS =
  /\b(income|salary|wages?|paycheck|deposit|refund|reimbursement|dividend|interest earned|bonus|gift received|cashback)\b/i

/** Keywords in CSV category names that indicate expense */
const EXPENSE_CAT_KEYWORDS =
  /\b(expense|bill|fee|charge|purchase|withdrawal|utilities|rent|groceries|dining|entertainment|subscription)\b/i

/** Keywords in CSV category names that indicate a transfer */
const TRANSFER_CAT_KEYWORDS =
  /\b(transfer|credit card payment|payment transfer|internal transfer|account transfer)\b/i

/**
 * Fuzzy-match a CSV category name to an existing category when exact match fails.
 * Tries contains matching and word overlap, prioritizing budget-linked categories
 * and categories whose type aligns with the transaction amount sign.
 */
function findPartialCategoryMatch<T extends { id: string; name: string; type?: string }>(
  csvKey: string,
  categoryMap: Map<string, T>,
  budgetCategoryIds: Set<string>,
  amountSign?: number
): T | null {
  const csvWords = new Set(csvKey.split(/[\s&,]+/).filter((w) => w.length > 2))
  const expectedType =
    amountSign !== undefined ? (amountSign > 0 ? 'income' : 'expense') : undefined

  let bestMatch: T | null = null
  let bestScore = 0

  for (const [existingKey, existingCat] of categoryMap) {
    if (existingKey === csvKey) continue

    let score = 0

    // Contains match: "mortgage payment" contains "mortgage", etc.
    if (csvKey.includes(existingKey) || existingKey.includes(csvKey)) {
      const shorter = Math.min(existingKey.length, csvKey.length)
      const longer = Math.max(existingKey.length, csvKey.length)
      score = shorter / longer
    }

    // Word overlap: "internet service" vs "internet & cable" share "internet"
    if (score === 0 && csvWords.size > 0) {
      const existingWords = new Set(existingKey.split(/[\s&,]+/).filter((w) => w.length > 2))
      let overlap = 0
      for (const w of csvWords) {
        if (existingWords.has(w)) overlap++
      }
      if (overlap > 0) {
        score = overlap / Math.max(csvWords.size, existingWords.size)
      }
    }

    // Budget-linked categories get a priority bonus
    if (score > 0 && budgetCategoryIds.has(existingCat.id)) {
      score += 0.3
    }

    // Prefer categories whose type matches the amount sign
    const catType = (existingCat as { type?: string }).type
    if (score > 0 && expectedType && catType) {
      if (catType === expectedType) {
        score += 0.2
      } else if (catType !== 'transfer') {
        score -= 0.2
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestMatch = existingCat
    }
  }

  return bestScore >= 0.4 ? bestMatch : null
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { csvText, mapping, accountId, skipDuplicates = true, isMonarch = false } = body

    if (!csvText) {
      return NextResponse.json({ error: 'Missing CSV text' }, { status: 400 })
    }
    if (!isMonarch && !mapping) {
      return NextResponse.json({ error: 'Missing column mapping' }, { status: 400 })
    }

    // Verify account ownership if specified
    if (accountId) {
      const account = await db.account.findUnique({
        where: { id: accountId, userId: session.userId },
      })
      if (!account) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 })
      }
    }

    const { headers, rows } = parseCSV(csvText)

    // Load user + system default categories for matching (user overrides defaults)
    const allCategories = await db.category.findMany({
      where: {
        OR: [{ userId: session.userId }, { userId: null, isDefault: true }],
      },
      orderBy: { userId: 'asc' }, // nulls (defaults) first, so user categories overwrite in Map
    })
    const categoryMap = new Map(allCategories.map((c) => [c.name.toLowerCase(), c]))

    // Load budget-linked categories so partial matching can prioritize them
    const userBudgets = await db.budget.findMany({
      where: { userId: session.userId, categoryId: { not: null } },
      select: { categoryId: true },
    })
    const budgetCategoryIds = new Set(userBudgets.map((b) => b.categoryId!))

    // Load user's accounts for matching (Monarch has Account column)
    const userAccounts = await db.account.findMany({
      where: { userId: session.userId },
    })
    const accountMap = new Map(userAccounts.map((a) => [a.name.toLowerCase(), a]))

    // Load user's household members and properties for CSV person/property mapping
    const userMembers = await db.householdMember.findMany({
      where: { userId: session.userId },
    })
    const memberMap = new Map(userMembers.map((m) => [m.name.toLowerCase(), m]))

    const userProperties = await db.property.findMany({
      where: { userId: session.userId },
    })
    const propertyMap = new Map(userProperties.map((p) => [p.name.toLowerCase(), p]))

    // R1.8: Build merchant→categoryId lookup from user's existing categorized transactions.
    // For each merchant, find the most frequently used category.
    const merchantCatRows = await db.transaction.groupBy({
      by: ['merchant', 'categoryId'],
      where: { userId: session.userId, categoryId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    })
    const merchantCategoryMap = new Map<string, string>()
    for (const row of merchantCatRows) {
      const key = row.merchant.toLowerCase()
      // First entry per merchant is the most frequent (ordered desc above)
      if (!merchantCategoryMap.has(key) && row.categoryId) {
        merchantCategoryMap.set(key, row.categoryId)
      }
    }

    let transactionsToProcess: {
      date: string
      merchant: string
      amount: number
      category?: string
      account?: string
      person?: string
      property?: string
      originalStatement?: string
      notes?: string
      tags?: string
      transactionType?: string
    }[]

    let parseErrors: { row: number; message: string }[] = []
    let totalRows = rows.length

    if (isMonarch) {
      // Direct Monarch mapping - headers are known
      const dateIdx = headers.findIndex((h) => h.toLowerCase() === 'date')
      const merchantIdx = headers.findIndex((h) => h.toLowerCase() === 'merchant')
      const categoryIdx = headers.findIndex((h) => h.toLowerCase() === 'category')
      const accountIdx = headers.findIndex((h) => h.toLowerCase() === 'account')
      const origStmtIdx = headers.findIndex((h) => h.toLowerCase() === 'original statement')
      const notesIdx = headers.findIndex((h) => h.toLowerCase() === 'notes')
      const amountIdx = headers.findIndex((h) => h.toLowerCase() === 'amount')
      const txTypeIdx = headers.findIndex((h) => h.toLowerCase() === 'transaction type')
      const tagsIdx = headers.findIndex((h) => h.toLowerCase() === 'tags')

      transactionsToProcess = []
      rows.forEach((row, rowIndex) => {
        if (row.every((cell) => !cell.trim())) return
        const rawDate = row[dateIdx]?.trim()
        if (!rawDate) {
          parseErrors.push({ row: rowIndex + 2, message: 'Missing date' })
          return
        }
        const rawAmount = row[amountIdx]?.trim()
        const amount = parseFloat(rawAmount?.replace(/[$,]/g, '') || '0')
        if (isNaN(amount)) {
          parseErrors.push({ row: rowIndex + 2, message: `Invalid amount: ${rawAmount}` })
          return
        }
        transactionsToProcess.push({
          date: rawDate,
          merchant: row[merchantIdx]?.trim() || 'Unknown',
          amount,
          category: categoryIdx >= 0 ? row[categoryIdx]?.trim() : undefined,
          account: accountIdx >= 0 ? row[accountIdx]?.trim() : undefined,
          originalStatement: origStmtIdx >= 0 ? row[origStmtIdx]?.trim() : undefined,
          notes: notesIdx >= 0 ? row[notesIdx]?.trim() : undefined,
          tags: tagsIdx >= 0 ? row[tagsIdx]?.trim() : undefined,
          transactionType: txTypeIdx >= 0 ? row[txTypeIdx]?.trim().toLowerCase() : undefined,
        })
      })
    } else {
      // Use standard column mapping
      const result = transformRows(rows, headers, mapping)
      parseErrors = result.errors
      totalRows = result.totalRows
      transactionsToProcess = result.transactions.map((tx) => ({
        date: tx.date,
        merchant: tx.merchant,
        amount: tx.amount,
        category: tx.category,
        account: tx.account,
        person: tx.person,
        property: tx.property,
      }))
    }

    if (transactionsToProcess.length === 0) {
      return NextResponse.json({
        imported: 0,
        errors: parseErrors,
        duplicates: 0,
        message: 'No valid transactions found',
      })
    }

    // Check for duplicates and prepare import data
    let duplicateCount = 0
    const toImport: {
      userId: string
      accountId: string | null
      householdMemberId: string | null
      propertyId: string | null
      date: Date
      merchant: string
      amount: number
      classification: string
      categoryId: string | null
      originalCategory: string | null
      originalStatement: string | null
      notes: string | null
      tags: string | null
      transactionType: string | null
      importSource: string
    }[] = []

    for (const tx of transactionsToProcess) {
      const txDate = new Date(tx.date)
      if (isNaN(txDate.getTime())) {
        parseErrors.push({ row: 0, message: `Invalid date: ${tx.date}` })
        continue
      }

      if (skipDuplicates) {
        const existing = await db.transaction.findFirst({
          where: {
            userId: session.userId,
            date: txDate,
            amount: tx.amount,
            merchant: tx.merchant,
          },
        })
        if (existing) {
          duplicateCount++
          continue
        }
      }

      // Match category by name — exact first, then partial, then auto-create
      let categoryId: string | null = null
      if (tx.category && tx.category.trim() !== '') {
        const catKey = tx.category.toLowerCase()
        let matched = categoryMap.get(catKey) ?? null

        // Fallback: partial/fuzzy match, prioritizing budget-linked categories + type alignment
        if (!matched) {
          matched = findPartialCategoryMatch(catKey, categoryMap, budgetCategoryIds, tx.amount)
          if (matched) {
            categoryMap.set(catKey, matched)
          }
        }

        if (matched) {
          categoryId = matched.id
        } else {
          // Infer category type from transactionType (most reliable), then category name keywords, then amount sign
          const isTransfer = tx.transactionType === 'transfer' ||
            TRANSFER_CAT_KEYWORDS.test(catKey)
          const isCredit = tx.transactionType === 'credit'
          const nameHasIncomeSignal = INCOME_CAT_KEYWORDS.test(catKey) && !EXPENSE_CAT_KEYWORDS.test(catKey)
          const catType = isTransfer ? 'transfer' : (isCredit || nameHasIncomeSignal || tx.amount > 0) ? 'income' : 'expense'

          // Auto-create category with best-fit group (R1.6 — never use "Imported")
          const bestGroup = inferCategoryGroup(tx.category.trim(), catType)
          const newCat = await db.category.create({
            data: {
              userId: session.userId,
              name: tx.category.trim(),
              type: catType,
              group: bestGroup,
              isDefault: false,
            },
          })
          categoryId = newCat.id
          categoryMap.set(catKey, newCat)
        }
      }

      // R1.8: Auto-categorize by merchant history when CSV had no category
      if (!categoryId && tx.merchant) {
        const merchantKey = tx.merchant.toLowerCase()
        const histCatId = merchantCategoryMap.get(merchantKey)
        if (histCatId) {
          categoryId = histCatId
        }
      }

      // Match account by name (Monarch) or use provided accountId
      // Try exact match first, then partial match, then auto-create (R1.5)
      let resolvedAccountId: string | null = accountId ?? null
      if (tx.account) {
        const csvAccountKey = tx.account.toLowerCase().trim()
        const exactMatch = accountMap.get(csvAccountKey)
        if (exactMatch) {
          resolvedAccountId = exactMatch.id
        } else {
          // Partial match: "Webster Bank Checking" matches user account "Webster bank"
          let found = false
          for (const [userKey, userAccount] of accountMap) {
            if (csvAccountKey.includes(userKey) || userKey.includes(csvAccountKey)) {
              resolvedAccountId = userAccount.id
              accountMap.set(csvAccountKey, userAccount)
              found = true
              break
            }
          }
          // Auto-create account if no match found (R1.5)
          if (!found) {
            const newAccount = await db.account.create({
              data: {
                userId: session.userId,
                name: tx.account.trim(),
                type: inferAccountType(tx.account.trim()),
                balance: 0,
              },
            })
            accountMap.set(csvAccountKey, newAccount)
            resolvedAccountId = newAccount.id
          }
        }
      }

      // Match person (household member) by name or auto-create (R1.4)
      let resolvedMemberId: string | null = null
      if (tx.person) {
        const csvPersonKey = tx.person.toLowerCase().trim()
        const memberMatch = memberMap.get(csvPersonKey)
        if (memberMatch) {
          resolvedMemberId = memberMatch.id
        } else {
          // Auto-create household member
          const newMember = await db.householdMember.create({
            data: {
              userId: session.userId,
              name: tx.person.trim(),
              isDefault: false,
            },
          })
          memberMap.set(csvPersonKey, newMember)
          resolvedMemberId = newMember.id
        }
      }

      // R3.2a: If no person tag, use account owner as default
      if (!resolvedMemberId && resolvedAccountId) {
        // Find the matched account to check for ownerId
        for (const acct of accountMap.values()) {
          if (acct.id === resolvedAccountId && acct.ownerId) {
            resolvedMemberId = acct.ownerId
            break
          }
        }
      }

      // Match property by name or auto-create (R1.4)
      let resolvedPropertyId: string | null = null
      if (tx.property) {
        const csvPropertyKey = tx.property.toLowerCase().trim()
        const propertyMatch = propertyMap.get(csvPropertyKey)
        if (propertyMatch) {
          resolvedPropertyId = propertyMatch.id
        } else {
          // Auto-create property
          const newProperty = await db.property.create({
            data: {
              userId: session.userId,
              name: tx.property.trim(),
              type: 'PERSONAL',
              isDefault: false,
            },
          })
          propertyMap.set(csvPropertyKey, newProperty)
          resolvedPropertyId = newProperty.id
        }
      }

      // Normalize amount sign. Priority:
      //   1. transactionType ('credit'/'debit') — most reliable (Monarch CSV)
      //   2. CSV category name keywords ("income", "salary", etc.) — explicit user label
      //   3. Matched category type — fallback
      // App convention: income = positive, expense = negative.
      let finalAmount = tx.amount
      if (tx.transactionType === 'credit') {
        finalAmount = Math.abs(tx.amount)
      } else if (tx.transactionType === 'debit') {
        finalAmount = -Math.abs(tx.amount)
      } else {
        const csvCatLower = (tx.category || '').toLowerCase()
        const csvSaysIncome = INCOME_CAT_KEYWORDS.test(csvCatLower) && !EXPENSE_CAT_KEYWORDS.test(csvCatLower)
        const csvSaysExpense = EXPENSE_CAT_KEYWORDS.test(csvCatLower) && !INCOME_CAT_KEYWORDS.test(csvCatLower)

        if (csvSaysIncome) {
          finalAmount = Math.abs(tx.amount)
        } else if (csvSaysExpense) {
          finalAmount = -Math.abs(tx.amount)
        } else if (categoryId) {
          const resolvedCat = categoryMap.get(tx.category?.toLowerCase() ?? '')
          if (resolvedCat) {
            if (resolvedCat.type === 'expense') finalAmount = -Math.abs(tx.amount)
            else if (resolvedCat.type === 'income') finalAmount = Math.abs(tx.amount)
          }
        }
      }

      // Derive classification from category group (deterministic hierarchy).
      // Group is the source of truth: Transfers → transfer, Income → income, else expense.
      const matchedCat = categoryId
        ? [...categoryMap.values()].find(c => c.id === categoryId)
        : null
      const classification = classifyTransaction(
        (matchedCat as { group?: string } | null)?.group,
        matchedCat?.type,
        finalAmount,
      )

      toImport.push({
        userId: session.userId,
        accountId: resolvedAccountId,
        householdMemberId: resolvedMemberId,
        propertyId: resolvedPropertyId,
        date: txDate,
        merchant: tx.merchant,
        amount: finalAmount,
        classification,
        categoryId,
        originalCategory: tx.category?.trim() || null,
        originalStatement: tx.originalStatement ?? null,
        notes: tx.notes ?? null,
        tags: tx.tags ?? null,
        transactionType: tx.transactionType ?? null,
        importSource: 'csv',
      })
    }

    if (toImport.length === 0) {
      return NextResponse.json({
        imported: 0,
        duplicates: duplicateCount,
        errors: parseErrors,
        total: totalRows,
        message:
          duplicateCount > 0
            ? `All ${duplicateCount} transactions were duplicates`
            : 'No transactions to import',
      })
    }

    // Batch create in chunks of 500
    let importedCount = 0
    for (let i = 0; i < toImport.length; i += 500) {
      const chunk = toImport.slice(i, i + 500)
      const created = await db.transaction.createMany({ data: chunk })
      importedCount += created.count
    }

    // R1.5b: CSV-imported accounts do NOT compute balance by summing transactions.
    // Balance is manually entered by user via startingBalance + balanceAsOfDate.
    // New transactions after the baseline date adjust the running balance.

    // Reconcile any previously-imported transactions whose category didn't match budgets
    await reconcileBudgetCategories(session.userId)

    // R7.6: Create baseline snapshot on first import
    // Check if this is the user's first snapshot — if so, create one for the current month
    try {
      const existingSnapshots = await db.monthlySnapshot.count({ where: { userId: session.userId } })
      if (existingSnapshots === 0) {
        const now = new Date()
        await createMonthlySnapshot(session.userId, now.getFullYear(), now.getMonth() + 1)
      }
    } catch {
      // Non-critical — don't fail the import if snapshot creation fails
    }

    return NextResponse.json({
      imported: importedCount,
      duplicates: duplicateCount,
      errors: parseErrors,
      total: totalRows,
      message: `Successfully imported ${importedCount} transaction${importedCount !== 1 ? 's' : ''}`,
    })
  } catch (error) {
    console.error('CSV import failed:', error)
    return NextResponse.json({ error: 'Failed to import transactions' }, { status: 500 })
  }
}
