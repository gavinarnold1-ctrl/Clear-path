import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId') // TODO: replace with session user ID
  const type = searchParams.get('type') ?? undefined
  const accountId = searchParams.get('accountId') ?? undefined

  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const transactions = await db.transaction.findMany({
    where: {
      userId,
      ...(type && { type: type as 'INCOME' | 'EXPENSE' | 'TRANSFER' }),
      ...(accountId && { accountId }),
    },
    include: { account: true, category: true },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json(transactions)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { userId, accountId, categoryId, amount, description, date, type, notes } = body

  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const transaction = await db.transaction.create({
    data: { userId, accountId, categoryId, amount, description, date: new Date(date), type, notes },
    include: { account: true, category: true },
  })

  return NextResponse.json(transaction, { status: 201 })
}
