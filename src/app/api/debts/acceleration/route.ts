import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { computeDebtPayoffAcceleration } from '@/lib/engines/forecast'
import type { IncomeTransition, DebtForForecast } from '@/types'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const [debts, profile, expenseAgg, incomeAgg] = await Promise.all([
    db.debt.findMany({
      where: { userId: session.userId },
      include: { property: { select: { groupId: true } } },
      orderBy: { currentBalance: 'desc' },
    }),
    db.userProfile.findUnique({
      where: { userId: session.userId },
      select: { expectedMonthlyIncome: true, incomeTransitions: true },
    }),
    db.transaction.aggregate({
      where: { userId: session.userId, date: { gte: monthStart, lt: monthEnd }, amount: { lt: 0 } },
      _sum: { amount: true },
    }),
    db.transaction.aggregate({
      where: { userId: session.userId, date: { gte: monthStart, lt: monthEnd }, amount: { gt: 0 } },
      _sum: { amount: true },
    }),
  ])

  const incomeTransitions = (profile?.incomeTransitions as IncomeTransition[] | null) ?? []
  if (debts.length === 0 || incomeTransitions.length === 0) {
    return NextResponse.json([])
  }

  const currentMonthlyExpenses = Math.abs(expenseAgg._sum.amount ?? 0)
  const currentMonthlyIncome = profile?.expectedMonthlyIncome ?? (incomeAgg._sum.amount ?? 0)

  const debtInputs: DebtForForecast[] = debts.map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    balance: d.currentBalance,
    interestRate: d.interestRate,
    minimumPayment: d.minimumPayment,
    escrowAmount: d.escrowAmount ?? 0,
    propertyGroupId: d.property?.groupId ?? null,
  }))

  const results = computeDebtPayoffAcceleration(
    debtInputs,
    currentMonthlyExpenses,
    currentMonthlyIncome,
    incomeTransitions,
  )

  return NextResponse.json(results)
}
