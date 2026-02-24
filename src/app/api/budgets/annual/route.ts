import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const expenses = await db.annualExpense.findMany({
    where: { userId: session.userId },
    include: { budget: { include: { category: true } } },
    orderBy: [{ dueYear: 'asc' }, { dueMonth: 'asc' }],
  })

  const now = new Date()
  const enriched = expenses.map((exp) => {
    const targetDate = new Date(exp.dueYear, exp.dueMonth - 1, 1)
    const monthsRemaining = Math.max(
      0,
      (targetDate.getFullYear() - now.getFullYear()) * 12 +
        (targetDate.getMonth() - now.getMonth())
    )
    const remaining = Math.max(0, exp.annualAmount - exp.funded)
    const currentSetAside = monthsRemaining > 0 ? remaining / monthsRemaining : remaining

    let computedStatus = exp.status
    if (exp.status !== 'spent' && exp.status !== 'overspent') {
      if (exp.funded >= exp.annualAmount) {
        computedStatus = 'funded'
      } else if (monthsRemaining <= 0) {
        computedStatus = 'overdue'
      } else if (monthsRemaining <= 2 && exp.funded < exp.annualAmount * 0.5) {
        computedStatus = 'urgent'
      }
    }

    return {
      ...exp,
      monthsRemaining,
      currentSetAside,
      computedStatus,
      fundingPace: exp.annualAmount > 0 ? (exp.funded / exp.annualAmount) * 100 : 0,
    }
  })

  return NextResponse.json(enriched)
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, annualAmount, dueMonth, dueYear, categoryId, isRecurring, notes } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  if (!annualAmount || annualAmount <= 0) {
    return NextResponse.json({ error: 'Annual amount must be positive' }, { status: 400 })
  }
  if (!dueMonth || dueMonth < 1 || dueMonth > 12) {
    return NextResponse.json({ error: 'Due month must be between 1 and 12' }, { status: 400 })
  }
  if (!dueYear || dueYear < 2024) {
    return NextResponse.json({ error: 'Due year is required' }, { status: 400 })
  }

  const now = new Date()
  const targetDate = new Date(dueYear, dueMonth - 1, 1)
  const monthsUntilDue = Math.max(
    1,
    (targetDate.getFullYear() - now.getFullYear()) * 12 +
      (targetDate.getMonth() - now.getMonth())
  )
  const monthlySetAside = Math.ceil((annualAmount / monthsUntilDue) * 100) / 100

  const result = await db.$transaction(async (tx) => {
    const budget = await tx.budget.create({
      data: {
        name: name.trim(),
        amount: annualAmount,
        period: 'YEARLY',
        tier: 'ANNUAL',
        startDate: new Date(now.getFullYear(), 0, 1),
        endDate: targetDate,
        userId: session.userId,
        categoryId: categoryId || null,
      },
    })

    const annualExpense = await tx.annualExpense.create({
      data: {
        budgetId: budget.id,
        name: name.trim(),
        annualAmount,
        dueMonth,
        dueYear,
        isRecurring: isRecurring ?? false,
        monthlySetAside,
        funded: 0,
        status: 'planned',
        notes: notes?.trim() || null,
        userId: session.userId,
      },
    })

    return { budget, annualExpense }
  })

  return NextResponse.json(result, { status: 201 })
}
