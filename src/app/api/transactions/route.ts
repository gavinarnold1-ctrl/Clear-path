import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { recalculateBudgetSpentForCategory } from '@/lib/budget-utils'

const VALID_CATEGORY_TYPES = new Set(['income', 'expense', 'transfer'])

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const categoryType = searchParams.get('categoryType') ?? undefined
  const accountId = searchParams.get('accountId') ?? undefined

  if (categoryType && !VALID_CATEGORY_TYPES.has(categoryType)) {
    return NextResponse.json({ error: 'Invalid category type filter' }, { status: 400 })
  }

  const transactions = await db.transaction.findMany({
    where: {
      userId: session.userId,
      ...(categoryType && { category: { type: categoryType } }),
      ...(accountId && { accountId }),
    },
    include: { account: true, category: true },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json(transactions)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { accountId, categoryId, amount, merchant, date, notes, tags } = body

  if (!amount || !merchant || !date) {
    return NextResponse.json({ error: 'Missing required fields (merchant, amount, date)' }, { status: 400 })
  }

  // Correct amount sign based on category type — must match server action behavior.
  // Income = positive, expense = negative, transfer = keep user sign.
  let finalAmount = amount
  if (categoryId) {
    const category = await db.category.findUnique({ where: { id: categoryId } })
    if (category) {
      if (category.type === 'expense') finalAmount = -Math.abs(amount)
      else if (category.type === 'income') finalAmount = Math.abs(amount)
    }
  }

  const transaction = await db.$transaction(async (tx) => {
    const created = await tx.transaction.create({
      data: {
        userId: session.userId,
        accountId: accountId ?? null,
        categoryId: categoryId ?? null,
        amount: finalAmount,
        merchant,
        date: new Date(date),
        notes: notes ?? null,
        tags: tags ?? null,
      },
      include: { account: true, category: true },
    })

    // Update account balance
    if (created.accountId) {
      await tx.account.update({
        where: { id: created.accountId },
        data: { balance: { increment: created.amount } },
      })
    }

    return created
  })

  if (transaction.categoryId) {
    await recalculateBudgetSpentForCategory(session.userId, transaction.categoryId)
  }

  return NextResponse.json(transaction, { status: 201 })
}
