import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

const VALID_TIERS = new Set(['FIXED', 'FLEXIBLE', 'ANNUAL'])

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tier = req.nextUrl.searchParams.get('tier')

  const budgets = await db.budget.findMany({
    where: {
      userId: session.userId,
      ...(tier && VALID_TIERS.has(tier) ? { tier: tier as 'FIXED' | 'FLEXIBLE' | 'ANNUAL' } : {}),
    },
    include: { category: true, annualExpense: true },
    orderBy: { startDate: 'desc' },
  })

  return NextResponse.json(budgets)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { categoryId, name, amount, period, tier, startDate, endDate } = body

  if (!name || !amount || !startDate) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (tier && !VALID_TIERS.has(tier)) {
    return NextResponse.json({ error: 'Invalid budget tier' }, { status: 400 })
  }

  const budget = await db.budget.create({
    data: {
      userId: session.userId,
      categoryId: categoryId ?? null,
      name,
      amount,
      period: period ?? 'MONTHLY',
      tier: tier ?? 'FLEXIBLE',
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
    },
    include: { category: true, annualExpense: true },
  })

  return NextResponse.json(budget, { status: 201 })
}
