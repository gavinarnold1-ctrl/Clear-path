import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import type {
  BalanceHistory,
  CategoryBreakdownItem,
  BudgetPerformanceMonth,
  CategoryPerformanceItem,
  WealthGrowthMonth,
  GrowthBreakdownItem,
  DashboardGrowthResponse,
} from '@/types'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const period = req.nextUrl.searchParams.get('period') ?? '6mo'
  const monthLimit = period === '12mo' ? 12 : period === 'all' ? 120 : 6

  const snapshots = await db.monthlySnapshot.findMany({
    where: { userId: session.userId },
    orderBy: { month: 'desc' },
    take: monthLimit,
    select: {
      month: true,
      totalIncome: true,
      totalExpenses: true,
      netSurplus: true,
      savingsRate: true,
      totalDebt: true,
      netWorth: true,
      balanceHistory: true,
      categoryBreakdown: true,
    },
  })

  // Reverse to chronological order
  const sorted = snapshots.reverse()
  const availableMonths = sorted.length

  if (availableMonths < 2) {
    return NextResponse.json({
      budgetPerformance: {
        months: [],
        avgSurplus: 0,
        avgSavingsRate: 0,
        bestMonth: null,
        worstMonth: null,
        categoryBreakdown: [],
      },
      wealthGrowth: {
        months: [],
        totalGrowth: 0,
        breakdown: [],
      },
      availableMonths,
    } satisfies DashboardGrowthResponse)
  }

  // --- Budget Performance ---
  const perfMonths: BudgetPerformanceMonth[] = sorted.map((s) => ({
    month: formatMonth(s.month),
    income: s.totalIncome,
    expenses: s.totalExpenses,
    surplus: s.netSurplus,
    savingsRate: s.savingsRate,
  }))

  const avgSurplus = perfMonths.reduce((s, m) => s + m.surplus, 0) / perfMonths.length
  const avgSavingsRate = perfMonths.reduce((s, m) => s + m.savingsRate, 0) / perfMonths.length

  let bestMonth: string | null = null
  let worstMonth: string | null = null
  if (perfMonths.length > 0) {
    bestMonth = perfMonths.reduce((best, m) => (m.surplus > best.surplus ? m : best)).month
    worstMonth = perfMonths.reduce((worst, m) => (m.surplus < worst.surplus ? m : worst)).month
  }

  // Aggregate category breakdown across snapshots (latest snapshot's data)
  const latestWithCategories = sorted.findLast((s) => s.categoryBreakdown != null)
  const categoryBreakdown: CategoryPerformanceItem[] = []
  if (latestWithCategories?.categoryBreakdown) {
    const items = latestWithCategories.categoryBreakdown as unknown as CategoryBreakdownItem[]
    for (const item of items) {
      const delta = item.budgeted - item.spent
      categoryBreakdown.push({
        categoryName: item.categoryName,
        group: item.group,
        budgeted: item.budgeted,
        spent: item.spent,
        delta,
        pctOfBudget: item.budgeted > 0 ? (item.spent / item.budgeted) * 100 : 0,
      })
    }
    // Sort by most over-budget first
    categoryBreakdown.sort((a, b) => a.delta - b.delta)
  }

  // --- Wealth Growth ---
  const wealthMonths: WealthGrowthMonth[] = []
  const firstBalances = sorted[0]?.balanceHistory as unknown as BalanceHistory | null

  for (const s of sorted) {
    const bh = s.balanceHistory as unknown as BalanceHistory | null
    if (!bh || !firstBalances) {
      wealthMonths.push({ month: formatMonth(s.month), cash: 0, investments: 0, debtReduction: 0, total: 0 })
      continue
    }
    const cashDelta = bh.cash - firstBalances.cash
    const investDelta = bh.investments - firstBalances.investments
    const debtReduction = firstBalances.debt - bh.debt // positive = paid down
    const total = cashDelta + investDelta + debtReduction
    wealthMonths.push({
      month: formatMonth(s.month),
      cash: Math.round(cashDelta * 100) / 100,
      investments: Math.round(investDelta * 100) / 100,
      debtReduction: Math.round(debtReduction * 100) / 100,
      total: Math.round(total * 100) / 100,
    })
  }

  const lastBh = sorted[sorted.length - 1]?.balanceHistory as unknown as BalanceHistory | null
  const totalGrowth = lastBh && firstBalances
    ? (lastBh.cash - firstBalances.cash) + (lastBh.investments - firstBalances.investments) + (firstBalances.debt - lastBh.debt)
    : 0

  const breakdown: GrowthBreakdownItem[] = []
  if (lastBh && firstBalances) {
    const cashChange = lastBh.cash - firstBalances.cash
    const investChange = lastBh.investments - firstBalances.investments
    const debtChange = firstBalances.debt - lastBh.debt

    breakdown.push({
      label: 'Cash Savings',
      currentValue: lastBh.cash,
      changeAbs: Math.round(cashChange * 100) / 100,
      changePct: firstBalances.cash > 0 ? Math.round((cashChange / firstBalances.cash) * 10000) / 100 : 0,
    })
    breakdown.push({
      label: 'Investments',
      currentValue: lastBh.investments,
      changeAbs: Math.round(investChange * 100) / 100,
      changePct: firstBalances.investments > 0 ? Math.round((investChange / firstBalances.investments) * 10000) / 100 : 0,
    })
    breakdown.push({
      label: 'Debt Paydown',
      currentValue: lastBh.debt,
      changeAbs: Math.round(debtChange * 100) / 100,
      changePct: firstBalances.debt > 0 ? Math.round((debtChange / firstBalances.debt) * 10000) / 100 : 0,
    })
  }

  return NextResponse.json({
    budgetPerformance: {
      months: perfMonths,
      avgSurplus: Math.round(avgSurplus * 100) / 100,
      avgSavingsRate: Math.round(avgSavingsRate * 10000) / 10000,
      bestMonth,
      worstMonth,
      categoryBreakdown,
    },
    wealthGrowth: {
      months: wealthMonths,
      totalGrowth: Math.round(totalGrowth * 100) / 100,
      breakdown,
    },
    availableMonths,
  } satisfies DashboardGrowthResponse)
}

function formatMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
