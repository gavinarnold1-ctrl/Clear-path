import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { parseCSV, transformRows } from '@/lib/csv-parser'
import { recalculateBudgetSpent, recalculateAccountBalances } from '@/lib/budget-utils'

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

    // Load user's accounts for matching (Monarch has Account column)
    const userAccounts = await db.account.findMany({
      where: { userId: session.userId },
    })
    const accountMap = new Map(userAccounts.map((a) => [a.name.toLowerCase(), a]))

    let transactionsToProcess: {
      date: string
      merchant: string
      amount: number
      category?: string
      account?: string
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
      date: Date
      merchant: string
      amount: number
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

      // Match category by name — auto-create if not found
      let categoryId: string | null = null
      if (tx.category && tx.category.trim() !== '') {
        const catKey = tx.category.toLowerCase()
        const matched = categoryMap.get(catKey)
        if (matched) {
          categoryId = matched.id
        } else {
          // Infer category type from transaction amount and transactionType
          const isTransfer = tx.transactionType === 'transfer' ||
            catKey.includes('transfer') || catKey.includes('credit card payment')
          const catType = isTransfer ? 'transfer' : tx.amount > 0 ? 'income' : 'expense'

          // Auto-create category from CSV data
          const newCat = await db.category.create({
            data: {
              userId: session.userId,
              name: tx.category.trim(),
              type: catType,
              group: 'Imported',
              isDefault: false,
            },
          })
          categoryId = newCat.id
          // Cache so subsequent rows with the same category reuse this record
          categoryMap.set(catKey, newCat)
        }
      }

      // Match account by name (Monarch) or use provided accountId
      // Try exact match first, then partial match (CSV name contains user account or vice versa)
      let resolvedAccountId: string | null = accountId ?? null
      if (tx.account) {
        const csvAccountKey = tx.account.toLowerCase().trim()
        const exactMatch = accountMap.get(csvAccountKey)
        if (exactMatch) {
          resolvedAccountId = exactMatch.id
        } else {
          // Partial match: "Webster Bank Checking" matches user account "Webster bank"
          for (const [userKey, userAccount] of accountMap) {
            if (csvAccountKey.includes(userKey) || userKey.includes(csvAccountKey)) {
              resolvedAccountId = userAccount.id
              // Cache this CSV name for subsequent rows from the same account
              accountMap.set(csvAccountKey, userAccount)
              break
            }
          }
        }
      }

      toImport.push({
        userId: session.userId,
        accountId: resolvedAccountId,
        date: txDate,
        merchant: tx.merchant,
        amount: tx.amount,
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

    // Recalculate account balances and budget spent values after import
    await recalculateAccountBalances(session.userId)
    await recalculateBudgetSpent(session.userId)

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
