import { db } from './db'
import { getBenchmark, getEfficiencyRating } from './benchmarks'
import { generateInsights } from './ai'
import { buildTemporalContext, getSpendingVelocity } from './temporal-context'
import { buildBudgetContext } from './budget-context'
import { buildInsightHistory } from './insight-history'
import { getEntitySummary } from './entity-summary'
import type { TransactionSummary, RecurringCharge, MonthOverMonthItem } from '@/types/insights'

export async function buildTransactionSummary(
  userId: string,
  months: number = 3
): Promise<TransactionSummary> {
  const startDate = new Date()
  startDate.setMonth(startDate.getMonth() - months)

  const transactions = await db.transaction.findMany({
    where: {
      userId,
      date: { gte: startDate },
      classification: { not: 'transfer' },
    },
    include: {
      category: true,
      account: true,
    },
    orderBy: { date: 'desc' },
  })

  // Use classification for filtering: income vs expense (transfers already excluded)
  const income = transactions.filter((t) => t.classification === 'income')
  const expenses = transactions.filter((t) => t.classification === 'expense')

  const totalIncome = income.reduce((sum, t) => sum + t.amount, 0)
  const totalExpenses = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0)

  // Category breakdown with benchmarks
  const categoryMap = new Map<string, typeof expenses>()
  expenses.forEach((t) => {
    const catName = t.category?.name ?? 'Uncategorized'
    if (!categoryMap.has(catName)) categoryMap.set(catName, [])
    categoryMap.get(catName)!.push(t)
  })

  const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, txns]) => {
    const total = txns.reduce((sum, t) => sum + Math.abs(t.amount), 0)
    const monthlyAvg = total / months
    const benchmark = getBenchmark(category)

    return {
      category,
      total,
      transactionCount: txns.length,
      avgTransaction: total / txns.length,
      benchmark: benchmark
        ? {
            median: benchmark.monthlyMedian,
            percentile25: benchmark.p25,
            rating: getEfficiencyRating(monthlyAvg, benchmark),
          }
        : undefined,
    }
  })

  // Top merchants by spend
  const merchantMap = new Map<string, { total: number; count: number; category: string }>()
  expenses.forEach((t) => {
    const merchant = t.merchant
    const existing = merchantMap.get(merchant) ?? {
      total: 0,
      count: 0,
      category: t.category?.name ?? 'Uncategorized',
    }
    existing.total += Math.abs(t.amount)
    existing.count += 1
    merchantMap.set(merchant, existing)
  })

  const topMerchants = Array.from(merchantMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 15)

  const recurringCharges = detectRecurring(expenses)
  const monthOverMonthChange = calculateMoMChange(expenses)

  return {
    totalIncome,
    totalExpenses,
    netSavings: totalIncome - totalExpenses,
    savingsRate: totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0,
    categoryBreakdown: categoryBreakdown.sort((a, b) => b.total - a.total),
    topMerchants,
    recurringCharges,
    monthOverMonthChange,
    period: {
      start: startDate.toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0],
      months,
    },
  }
}

interface TransactionWithCategory {
  amount: number
  merchant: string
  date: Date
  category: { name: string } | null
}

function detectRecurring(expenses: TransactionWithCategory[]): RecurringCharge[] {
  const groups = new Map<string, number[]>()
  expenses.forEach((t) => {
    const key = t.merchant
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(Math.abs(t.amount))
  })

  const recurring: RecurringCharge[] = []

  groups.forEach((amounts, description) => {
    if (amounts.length < 2) return

    // Check if amounts are similar (within 10% of each other)
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length
    const allSimilar = amounts.every((a) => Math.abs(a - avg) / avg < 0.1)

    if (allSimilar) {
      recurring.push({
        description,
        amount: avg,
        frequency: amounts.length >= 3 ? 'monthly' : 'recurring',
      })
    }
  })

  return recurring.sort((a, b) => b.amount - a.amount)
}

function calculateMoMChange(expenses: TransactionWithCategory[]): MonthOverMonthItem[] {
  const now = new Date()
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const currentMonth = expenses.filter((t) => new Date(t.date) >= currentMonthStart)
  const prevMonth = expenses.filter(
    (t) => new Date(t.date) >= prevMonthStart && new Date(t.date) < currentMonthStart
  )

  const currentByCategory = new Map<string, number>()
  const prevByCategory = new Map<string, number>()

  currentMonth.forEach((t) => {
    const cat = t.category?.name ?? 'Uncategorized'
    currentByCategory.set(cat, (currentByCategory.get(cat) ?? 0) + Math.abs(t.amount))
  })

  prevMonth.forEach((t) => {
    const cat = t.category?.name ?? 'Uncategorized'
    prevByCategory.set(cat, (prevByCategory.get(cat) ?? 0) + Math.abs(t.amount))
  })

  const allCategories = new Set([...currentByCategory.keys(), ...prevByCategory.keys()])

  return Array.from(allCategories).map((category) => {
    const current = currentByCategory.get(category) ?? 0
    const previous = prevByCategory.get(category) ?? 0
    const changePercent =
      previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0

    return { category, currentMonth: current, previousMonth: previous, changePercent }
  })
}

export async function generateAndStoreInsights(userId: string) {
  const now = new Date()
  const [summary, temporal, velocity, budget, history, entitySummary] = await Promise.all([
    buildTransactionSummary(userId, 3),
    Promise.resolve(buildTemporalContext()),
    getSpendingVelocity(userId),
    buildBudgetContext(userId),
    buildInsightHistory(userId),
    getEntitySummary(userId, now.getFullYear(), now.getMonth()),
  ])

  const aiResponse = await generateInsights({
    summary,
    temporal,
    velocity,
    budget,
    history,
    entitySummary: entitySummary ?? undefined,
  })

  // Build context snapshot for storage
  const contextSnapshot = JSON.stringify({
    temporal,
    velocity,
    budgetUtilization: budget.utilizationPercent,
    overBudgetCount: budget.overBudgetCategories.length,
    historyCompletionRate: history.completionRate,
  })

  // Dismiss old active insights
  await db.insight.updateMany({
    where: { userId, status: 'active' },
    data: { status: 'dismissed', dismissReason: 'auto_replaced' },
  })

  // Store new insights
  const insights = await Promise.all(
    aiResponse.insights.map((insight) =>
      db.insight.create({
        data: {
          userId,
          category: insight.category,
          type: insight.type,
          priority: insight.priority,
          title: insight.title,
          description: insight.description,
          savingsAmount: insight.savingsAmount,
          actionItems: JSON.stringify(insight.actionItems),
          metadata: JSON.stringify({
            difficulty: insight.difficulty,
            savingsFrequency: insight.savingsFrequency,
          }),
          contextSnapshot,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      })
    )
  )

  // Store efficiency score
  const period = new Date().toISOString().slice(0, 7) // "2026-02"
  await db.efficiencyScore.upsert({
    where: { userId_period: { userId, period } },
    update: {
      overallScore: aiResponse.efficiencyScore.overall,
      spendingScore: aiResponse.efficiencyScore.spending,
      savingsScore: aiResponse.efficiencyScore.savings,
      debtScore: aiResponse.efficiencyScore.debt,
      breakdown: JSON.stringify(aiResponse.efficiencyScore),
    },
    create: {
      userId,
      period,
      overallScore: aiResponse.efficiencyScore.overall,
      spendingScore: aiResponse.efficiencyScore.spending,
      savingsScore: aiResponse.efficiencyScore.savings,
      debtScore: aiResponse.efficiencyScore.debt,
      breakdown: JSON.stringify(aiResponse.efficiencyScore),
    },
  })

  return {
    insights,
    efficiencyScore: aiResponse.efficiencyScore,
    highlightStat: aiResponse.highlightStat,
  }
}
