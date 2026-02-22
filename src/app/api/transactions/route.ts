import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const accountId = searchParams.get('accountId') ?? undefined

  const transactions = await db.transaction.findMany({
    where: {
      userId: session.userId,
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
  const { accountId, categoryId, amount, merchant, date, notes } = body

  if (!amount || !merchant || !date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const transaction = await db.transaction.create({
    data: {
      userId: session.userId,
      accountId: accountId ?? null,
      categoryId: categoryId ?? null,
      amount,
      merchant,
      date: new Date(date),
      notes: notes ?? null,
    },
    include: { account: true, category: true },
  })

  return NextResponse.json(transaction, { status: 201 })
}
