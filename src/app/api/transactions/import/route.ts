import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { parseCSV, transformRows } from '@/lib/csv-parser'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { csvText, mapping, accountId, skipDuplicates = true } = body

    if (!csvText || !mapping) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify fallback account ownership (if provided)
    if (accountId) {
      const fallbackAccount = await db.account.findUnique({
        where: { id: accountId, userId: session.userId },
      })
      if (!fallbackAccount) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 })
      }
    }

    // Build account lookup map for CSV account column matching
    const userAccounts = await db.account.findMany({
      where: { userId: session.userId },
    })
    const accountNameMap = new Map(
      userAccounts.map((a) => [a.name.toLowerCase(), a.id])
    )

    const { headers, rows } = parseCSV(csvText)
    const result = transformRows(rows, headers, mapping)

    if (result.transactions.length === 0) {
      return NextResponse.json({
        imported: 0,
        errors: result.errors,
        duplicates: 0,
        message: 'No valid transactions found',
      })
    }

    // Load user's categories for fuzzy matching (include system defaults)
    const userCategories = await db.category.findMany({
      where: { OR: [{ userId: session.userId }, { userId: null, isDefault: true }] },
    })
    const categoryMap = new Map(userCategories.map((c) => [c.name.toLowerCase(), c]))

    // Check for duplicates and prepare import data
    let duplicateCount = 0
    const toImport: {
      userId: string
      accountId: string | null
      date: Date
      merchant: string
      amount: number
      categoryId: string | null
    }[] = []

    for (const tx of result.transactions) {
      if (skipDuplicates) {
        const existing = await db.transaction.findFirst({
          where: {
            userId: session.userId,
            date: new Date(tx.date),
            amount: tx.amount,
            merchant: tx.merchant,
          },
        })
        if (existing) {
          duplicateCount++
          continue
        }
      }

      // Try to match CSV category to existing user category
      let categoryId: string | null = null
      if (tx.category) {
        const matched = categoryMap.get(tx.category.toLowerCase())
        if (matched) categoryId = matched.id
      }

      // Match CSV account name to user account, fall back to selected account
      let resolvedAccountId: string | null = accountId ?? null
      if (tx.account) {
        const matched = accountNameMap.get(tx.account.toLowerCase())
        if (matched) resolvedAccountId = matched
      }

      toImport.push({
        userId: session.userId,
        accountId: resolvedAccountId,
        date: new Date(tx.date),
        merchant: tx.merchant,
        amount: tx.amount,
        categoryId,
      })
    }

    if (toImport.length === 0) {
      return NextResponse.json({
        imported: 0,
        duplicates: duplicateCount,
        errors: result.errors,
        total: result.totalRows,
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

    return NextResponse.json({
      imported: importedCount,
      duplicates: duplicateCount,
      errors: result.errors,
      total: result.totalRows,
      message: `Successfully imported ${importedCount} transaction${importedCount !== 1 ? 's' : ''}`,
    })
  } catch (error) {
    console.error('CSV import failed:', error)
    return NextResponse.json({ error: 'Failed to import transactions' }, { status: 500 })
  }
}
