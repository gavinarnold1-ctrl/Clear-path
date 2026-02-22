import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

const VALID_TIERS = new Set(['fixed', 'flexible', 'annual'])

export async function GET(_req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const budgets = await db.budget.findMany({
    where: { userId: session.userId },
    include: { category: true },
    orderBy: { startDate: 'desc' },
  })

  return NextResponse.json(budgets)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { categoryId, name, amount, tier, startDate, endDate } = body

  if (!name || !amount || !tier || !startDate) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (!VALID_TIERS.has(tier)) {
    return NextResponse.json({ error: 'Invalid budget tier' }, { status: 400 })
  }

  const budget = await db.budget.create({
    data: {
      userId: session.userId,
      categoryId: categoryId ?? null,
      name,
      amount,
      tier,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
    },
    include: { category: true },
  })

  return NextResponse.json(budget, { status: 201 })
}
