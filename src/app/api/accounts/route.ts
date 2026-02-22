import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

const VALID_TYPES = new Set([
  'CHECKING', 'SAVINGS', 'CREDIT_CARD', 'INVESTMENT', 'CASH',
  'MORTGAGE', 'AUTO_LOAN', 'STUDENT_LOAN',
])

export async function GET(_req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accounts = await db.account.findMany({
    where: { userId: session.userId },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(accounts)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, type, balance, currency } = body

  if (!name || !type) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  if (!VALID_TYPES.has(type)) return NextResponse.json({ error: 'Invalid account type' }, { status: 400 })

  const account = await db.account.create({
    data: {
      userId: session.userId,
      name,
      type,
      balance: balance ?? 0,
      currency: currency ?? 'USD',
    },
  })

  return NextResponse.json(account, { status: 201 })
}
