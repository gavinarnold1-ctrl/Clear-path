import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

const VALID_TYPES = new Set(['INCOME', 'EXPENSE', 'TRANSFER'])

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') ?? undefined
  const accountId = searchParams.get('accountId') ?? undefined

  if (type && !VALID_TYPES.has(type)) {
    return NextResponse.json({ error: 'Invalid type filter' }, { status: 400 })
  }

  const transactions = await db.transaction.findMany({
    where: {
      userId: session.userId,
      ...(type && { type: type as 'INCOME' | 'EXPENSE' | 'TRANSFER' }),
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
  const { accountId, categoryId, amount, description, date, type, notes } = body

  if (!accountId || !amount || !description || !date || !type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (!VALID_TYPES.has(type)) {
    return NextResponse.json({ error: 'Invalid transaction type' }, { status: 400 })
  }

  const transaction = await db.transaction.create({
    data: {
      userId: session.userId,
      accountId,
      categoryId: categoryId ?? null,
      amount,
      description,
      date: new Date(date),
      type,
      notes: notes ?? null,
    },
    include: { account: true, category: true },
  })

  return NextResponse.json(transaction, { status: 201 })
}
