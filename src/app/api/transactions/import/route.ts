import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { parseCSV, transformRows } from '@/lib/csv-parser'
import { reconcileBudgetCategories } from '@/lib/budget-utils'
import { createMonthlySnapshot } from '@/lib/snapshots'
import { inferCategoryGroup, classifyTransaction } from '@/lib/category-groups'
import { applyPropertyAttribution } from '@/lib/apply-splits'
import { canonicalizeMerchant } from '@/lib/normalize-merchant'
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

/** Compute word overlap ratio between two merchant names for fuzzy matching */
function merchantWordOverlap(a: string, b: string): number {
  const wordsA = new Set(a.split(/[\s\-_/]+/).filter(w => w.length > 1))
  const wordsB = new Set(b.split(/[\s\-_/]+/).filter(w => w.length > 1))
  if (wordsA.size === 0 || wordsB.size === 0) return 0
  let overlap = 0
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++
  }
  return overlap / Math.max(wordsA.size, wordsB.size)
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

  // Size limit: 10MB for CSV uploads, 50K rows max
  const MAX_CSV_SIZE = 10 * 1024 * 1024
  const MAX_ROWS = 50_000

  try {
    const body = await request.json()
    const { csvText, mapping, accountId, skipDuplicates = true, isMonarch = false } = body

    if (!csvText) {
      return NextResponse.json({ error: 'Missing CSV text' }, { status: 400 })
    }

    // Validate actual content size — Content-Length headers can be spoofed
    if (typeof csvText !== 'string' || csvText.length > MAX_CSV_SIZE) {
      return NextResponse.json(
        { error: `CSV content exceeds maximum size of ${MAX_CSV_SIZE / 1024 / 1024}MB` },
        { status: 413 }
      )
    }

    // Row count limit as defense-in-depth
    const lineCount = csvText.split('\n').length
    if (lineCount > MAX_ROWS) {
      return NextResponse.json(
        { error: `CSV exceeds maximum of ${MAX_ROWS.toLocaleString()} rows` },
        { status: 413 }
      )
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

    // Load account-property links for auto-property resolution
    const acctPropLinks = await db.accountPropertyLink.findMany({
      where: { account: { userId: session.userId } },
    })
    const acctPropertyMap = new Map(acctPropLinks.map(l => [l.accountId, l.propertyId]))

    // Smart Category Learning v2: Load user's explicit category mappings with multi-signal context
    const userMappings = await db.userCategoryMapping.findMany({
      where: { userId: session.userId },
    })
    // Group mappings by merchant name for multi-signal matching
    const merchantMappings = new Map<string, typeof userMappings>()
    for (const m of userMappings) {
      const arr = merchantMappings.get(m.merchantName) ?? []
      arr.push(m)
      merchantMappings.set(m.merchantName, arr)
    }

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

    // Track mapping IDs that were used for auto-categorization (to increment timesApplied)
    const mappingIdsToIncrement: string[] = []

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
      const txDate = new Date(tx.date.includes('T') ? tx.date : `${tx.date}T12:00:00`)
      if (isNaN(txDate.getTime())) {
        parseErrors.push({ row: 0, message: `Invalid date: ${tx.date}` })
        continue
      }

      if (skipDuplicates) {
        // Exact match: same date, amount, merchant
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

        // Cross-source dedup: CSV transaction may match a Plaid transaction
        // with a different merchant name variant (e.g., "STARBUCKS #123" vs "Starbucks").
        // Count how many Plaid transactions match this pattern — only skip if
        // there are more Plaid matches than already-imported CSV matches
        // (handles 2 legitimate purchases at same merchant/amount/day).
        const canonicalKey = canonicalizeMerchant(tx.merchant)
        const plaidMatches = await db.transaction.findMany({
          where: {
            userId: session.userId,
            date: {
              gte: new Date(txDate.getTime() - 24 * 60 * 60 * 1000),
              lte: new Date(txDate.getTime() + 24 * 60 * 60 * 1000),
            },
            amount: tx.amount,
            importSource: 'plaid',
          },
        })
        const matchingPlaid = plaidMatches.filter(
          m => canonicalizeMerchant(m.merchant) === canonicalKey
        )
        if (matchingPlaid.length > 0) {
          // Count CSV rows already imported for this same pattern
          const alreadyImportedCsv = await db.transaction.count({
            where: {
              userId: session.userId,
              date: {
                gte: new Date(txDate.getTime() - 24 * 60 * 60 * 1000),
                lte: new Date(txDate.getTime() + 24 * 60 * 60 * 1000),
              },
              amount: tx.amount,
              importSource: 'csv',
            },
          })
          // Only skip if there are still unmatched Plaid transactions
          if (matchingPlaid.length > alreadyImportedCsv) {
            duplicateCount++
            continue
          }
        }
      }

      // Category resolution order:
      // 1. Exact CSV category match (user's own categories or system defaults)
      // 2. Smart learning (UserCategoryMapping) — user's explicit reclassifications take priority over fuzzy
      // 3. Fuzzy CSV category match (partial name overlap)
      // 4. Merchant history (most-frequent category for this merchant)
      // 5. Auto-create category from CSV name
      let categoryId: string | null = null
      let learnedPropertyId: string | null = null

      // Step 1: Exact CSV category match
      if (tx.category && tx.category.trim() !== '') {
        const catKey = tx.category.toLowerCase()
        const exactMatch = categoryMap.get(catKey) ?? null
        if (exactMatch) {
          categoryId = exactMatch.id
        }
      }

      // Step 2: Smart Category Learning — user's explicit merchant→category mappings.
      // These represent conscious user decisions and override CSV's default categories.
      if (!categoryId && tx.merchant) {
        const merchantKey = tx.merchant.toLowerCase().trim()
        const txDirection = tx.amount > 0 ? 'credit' : 'debit'
        const txAbsAmount = Math.abs(tx.amount)

        // Score each candidate mapping for this merchant
        const mappings = merchantMappings.get(merchantKey)
        if (mappings && mappings.length > 0) {
          let bestMapping: (typeof mappings)[0] | null = null
          let bestScore = 0

          for (const m of mappings) {
            let score = 0.7 // Base: merchant name exact match

            // Direction signal
            if (m.direction) {
              if (m.direction === txDirection) score += 0.15
              else score -= 0.5 // Direction mismatch is a strong negative signal
            }

            // Amount range signal
            if (m.amountMin != null && m.amountMax != null) {
              if (txAbsAmount >= m.amountMin && txAbsAmount <= m.amountMax) score += 0.15
              else score -= 0.2
            }

            if (score > bestScore) {
              bestScore = score
              bestMapping = m
            }
          }

          // Only auto-apply if confidence threshold met
          if (bestMapping && bestScore >= 0.7) {
            categoryId = bestMapping.categoryId
            mappingIdsToIncrement.push(bestMapping.id)
            // Smart property learning: auto-apply property from mapping
            if (bestMapping.propertyId) {
              learnedPropertyId = bestMapping.propertyId
            }
          }
        } else {
          // Fuzzy match: check for similar merchants (word overlap > 0.7)
          for (const [mappedMerchant, mappedList] of merchantMappings) {
            if (merchantWordOverlap(merchantKey, mappedMerchant) > 0.7) {
              const dirMatch = mappedList.find(m => !m.direction || m.direction === txDirection)
              const fallback = mappedList[0]
              const selected = dirMatch ?? fallback
              if (selected && selected.confidence >= 0.7) {
                categoryId = selected.categoryId
                mappingIdsToIncrement.push(selected.id)
                if (selected.propertyId) {
                  learnedPropertyId = selected.propertyId
                }
              }
              break
            }
          }
        }
      }

      // Step 3: Fuzzy CSV category match (partial name overlap, budget-linked priority)
      if (!categoryId && tx.category && tx.category.trim() !== '') {
        const catKey = tx.category.toLowerCase()
        const fuzzyMatch = findPartialCategoryMatch(catKey, categoryMap, budgetCategoryIds, tx.amount)
        if (fuzzyMatch) {
          categoryId = fuzzyMatch.id
          categoryMap.set(catKey, fuzzyMatch)
        }
      }

      // Step 4: Merchant history — most frequently used category for this merchant
      if (!categoryId && tx.merchant) {
        const merchantKey = tx.merchant.toLowerCase()
        const histCatId = merchantCategoryMap.get(merchantKey)
        if (histCatId) {
          categoryId = histCatId
        }
      }

      // Step 5: Auto-create category from CSV name if nothing else matched
      if (!categoryId && tx.category && tx.category.trim() !== '') {
        const catKey = tx.category.toLowerCase()
        const isTransfer = tx.transactionType === 'transfer' ||
          TRANSFER_CAT_KEYWORDS.test(catKey)
        const isCredit = tx.transactionType === 'credit'
        const nameHasIncomeSignal = INCOME_CAT_KEYWORDS.test(catKey) && !EXPENSE_CAT_KEYWORDS.test(catKey)
        const catType = isTransfer ? 'transfer' : (isCredit || nameHasIncomeSignal || tx.amount > 0) ? 'income' : 'expense'

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

      // Apply learned property from smart learning if CSV didn't specify one
      if (!resolvedPropertyId && learnedPropertyId) {
        resolvedPropertyId = learnedPropertyId
      }

      // Apply property from account-property link if still not set
      if (!resolvedPropertyId && resolvedAccountId) {
        const linkedPropertyId = acctPropertyMap.get(resolvedAccountId)
        if (linkedPropertyId) {
          resolvedPropertyId = linkedPropertyId
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
      const classification = matchedCat?.type === 'perk_reimbursement'
        ? 'perk_reimbursement'
        : classifyTransaction(
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

    // Increment timesApplied for any smart category mappings used during import
    if (mappingIdsToIncrement.length > 0) {
      const uniqueIds = [...new Set(mappingIdsToIncrement)]
      try {
        for (const mappingId of uniqueIds) {
          const count = mappingIdsToIncrement.filter(id => id === mappingId).length
          await db.userCategoryMapping.update({
            where: { id: mappingId },
            data: { timesApplied: { increment: count } },
          })
        }
      } catch {
        // Non-critical — don't fail the import
      }
    }

    // Auto-apply property attribution splits for imported transactions with a property
    try {
      const importedWithProperty = await db.transaction.findMany({
        where: {
          userId: session.userId,
          propertyId: { not: null },
          importSource: 'csv',
          splits: { none: {} },
        },
        select: { id: true, propertyId: true, amount: true, merchant: true, originalStatement: true, category: { select: { name: true } } },
        take: 1000,
        orderBy: { createdAt: 'desc' },
      })
      for (const tx of importedWithProperty) {
        await applyPropertyAttribution(
          tx.id,
          tx.propertyId,
          tx.amount,
          tx.merchant,
          tx.category?.name,
          tx.originalStatement
        )
      }
    } catch {
      // Non-critical — don't fail the import if split auto-apply fails
    }

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

    // Invalidate cached pages so dashboard/transactions show fresh data
    revalidatePath('/dashboard')
    revalidatePath('/transactions')
    revalidatePath('/budgets')
    revalidatePath('/spending')

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
