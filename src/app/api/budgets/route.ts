import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId') // TODO: replace with session user ID

  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const budgets = await db.budget.findMany({
    where: { userId },
    include: { category: true },
    orderBy: { startDate: 'desc' },
  })

  return NextResponse.json(budgets)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { userId, categoryId, name, amount, period, startDate, endDate } = body

  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const budget = await db.budget.create({
    data: {
      userId,
      categoryId: categoryId ?? null,
      name,
      amount,
      period,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
    },
    include: { category: true },
  })

  return NextResponse.json(budget, { status: 201 })
}
