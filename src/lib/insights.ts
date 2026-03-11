import { db } from './db'
import { getBenchmark, getEfficiencyRating } from './benchmarks'
import { generateInsights } from './ai'
import { buildTemporalContext, getSpendingVelocity } from './temporal-context'
import { buildBudgetContext } from './budget-context'
import { buildInsightHistory } from './insight-history'
import { getEntitySummary } from './entity-summary'
import { getGoalContext } from './goal-context'
import type { TransactionSummary, RecurringCharge, MonthOverMonthItem } from '@/types/insights'
import { computeBenefitAlerts } from './engines/benefit-alerts'
import type { BenefitAlertInput } from './engines/benefit-alerts'
import { canonicalizeMerchant } from './normalize-merchant'
import { assembleAIContext } from './ai-context'

/** Transaction references detected during summary building, used to attach to insights */
interface TransactionRefs {
  potentialDuplicates: {
    merchant: string
    date: string
    amount: number
    transactionIds: string[]
  }[]
  largeTransactions: {
    id: string
    merchant: string
    amount: number
    date: string
  }[]
  categoryTransactionIds: Record<string, string[]>
  periodStart: string
  periodEnd: string
}

export async function buildTransactionSummary(
  userId: string,
  months: number = 3,
  scopeDate?: { startDate: Date; endDate: Date }
): Promise<TransactionSummary & { _refs: TransactionRefs }> {
  const startDate = scopeDate?.startDate ?? (() => {
    const d = new Date()
    d.setMonth(d.getMonth() - months)
    return d
  })()
  const endDateFilter = scopeDate?.endDate ?? undefined

  const effectiveMonths = scopeDate ? 1 : months

  const transactions = await db.transaction.findMany({
    where: {
      userId,
      date: { gte: startDate, ...(endDateFilter ? { lte: endDateFilter } : {}) },
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
    const monthlyAvg = total / effectiveMonths
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

  // --- Build transaction references for insight drill-down ---

  // Duplicate detection: group by [canonical merchant, date, |amount|]
  const dupeGroups = new Map<string, { ids: string[]; merchant: string; date: string; amount: number }>()
  for (const tx of transactions) {
    const key = `${canonicalizeMerchant(tx.merchant)}|${tx.date.toISOString().slice(0, 10)}|${Math.abs(tx.amount)}`
    const existing = dupeGroups.get(key)
    if (existing) {
      existing.ids.push(tx.id)
    } else {
      dupeGroups.set(key, {
        ids: [tx.id],
        merchant: tx.merchant,
        date: tx.date.toISOString().slice(0, 10),
        amount: Math.abs(tx.amount),
      })
    }
  }
  const potentialDuplicates = [...dupeGroups.values()]
    .filter(g => g.ids.length > 1)
    .map(g => ({
      merchant: g.merchant,
      date: g.date,
      amount: g.amount,
      transactionIds: g.ids,
    }))

  // Large transaction detection: expenses > 2x category average
  const categoryAvg = new Map<string, number>()
  for (const [catName, txns] of categoryMap) {
    const avg = txns.reduce((sum, t) => sum + Math.abs(t.amount), 0) / txns.length
    categoryAvg.set(catName, avg)
  }
  const largeTransactions = expenses
    .filter(tx => {
      const catName = tx.category?.name ?? 'Uncategorized'
      const avg = categoryAvg.get(catName) ?? 0
      return avg > 0 && Math.abs(tx.amount) > avg * 2
    })
    .slice(0, 50)
    .map(tx => ({
      id: tx.id,
      merchant: tx.merchant,
      amount: tx.amount,
      date: tx.date.toISOString().slice(0, 10),
    }))

  // Category → transaction ID mapping
  const categoryTransactionIds: Record<string, string[]> = {}
  for (const [catName, txns] of categoryMap) {
    categoryTransactionIds[catName] = txns.map(t => t.id)
  }

  const periodStart = startDate.toISOString().split('T')[0]
  const periodEnd = new Date().toISOString().split('T')[0]

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
      start: periodStart,
      end: periodEnd,
      months: effectiveMonths,
    },
    _refs: {
      potentialDuplicates,
      largeTransactions,
      categoryTransactionIds,
      periodStart,
      periodEnd,
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

/** Match an AI-generated insight to transaction references from the summary */
function attachTransactionRefs(
  insight: { category: string; type: string; title: string; description: string },
  refs: TransactionRefs
): { relatedTransactionIds?: string[]; relatedQuery?: Record<string, string> } {
  const titleLower = insight.title.toLowerCase()
  const descLower = insight.description.toLowerCase()

  // Duplicate insights → attach duplicate group IDs
  if (titleLower.includes('duplicate') || descLower.includes('duplicate')) {
    const matchingDupes = refs.potentialDuplicates.filter(d =>
      descLower.includes(d.merchant.toLowerCase())
    )
    if (matchingDupes.length > 0) {
      return { relatedTransactionIds: matchingDupes.flatMap(d => d.transactionIds) }
    }
    // Fallback: return all duplicate IDs if we can't match a specific merchant
    if (refs.potentialDuplicates.length > 0) {
      return { relatedTransactionIds: refs.potentialDuplicates.flatMap(d => d.transactionIds) }
    }
  }

  // Large/unusual purchase insights → attach specific IDs
  if (insight.category === 'unusual_spending' || titleLower.includes('unusual') || titleLower.includes('large')) {
    if (refs.largeTransactions.length > 0) {
      return { relatedTransactionIds: refs.largeTransactions.map(t => t.id) }
    }
  }

  // Category-specific insights → attach category query
  if (insight.category === 'spending_optimization' || insight.category === 'spending' || insight.category === 'subscription') {
    // Try to match a category name from the insight text
    for (const [catName, ids] of Object.entries(refs.categoryTransactionIds)) {
      if (descLower.includes(catName.toLowerCase()) || titleLower.includes(catName.toLowerCase())) {
        // For large categories, use a query filter instead of IDs
        if (ids.length > 20) {
          return { relatedQuery: { category: catName, dateFrom: refs.periodStart, dateTo: refs.periodEnd } }
        }
        return { relatedTransactionIds: ids }
      }
    }
  }

  return {}
}

export async function generateAndStoreInsights(userId: string) {
  const now = new Date()
  const [summary, temporal, velocity, budget, history, entitySummary, goalContext, userCards, aiLearningContext] =
    await Promise.all([
      buildTransactionSummary(userId, 3),
      Promise.resolve(buildTemporalContext()),
      getSpendingVelocity(userId),
      buildBudgetContext(userId),
      buildInsightHistory(userId),
      getEntitySummary(userId, now.getFullYear(), now.getMonth()),
      getGoalContext(userId),
      db.userCard.findMany({
        where: { userId, isActive: true },
        select: {
          id: true,
          openedDate: true,
          cardProgram: { select: { issuer: true, name: true, annualFee: true } },
          benefits: {
            where: { isOptedIn: true },
            select: {
              id: true,
              usedAmount: true,
              lastResetDate: true,
              isOptedIn: true,
              cardBenefit: {
                select: { id: true, name: true, creditAmount: true, creditCycle: true },
              },
            },
          },
        },
      }),
      assembleAIContext(userId, 'insights'),
    ])

  // Build benefit alerts for AI context
  const alertInputs: BenefitAlertInput[] = []
  for (const card of userCards) {
    for (const ub of card.benefits) {
      if (!ub.cardBenefit.creditAmount || !ub.cardBenefit.creditCycle) continue
      alertInputs.push({
        benefitId: ub.cardBenefit.id,
        benefitName: ub.cardBenefit.name,
        cardIssuer: card.cardProgram.issuer,
        cardName: card.cardProgram.name,
        userCardId: card.id,
        creditAmount: ub.cardBenefit.creditAmount,
        creditCycle: ub.cardBenefit.creditCycle,
        usedAmount: ub.usedAmount,
        lastResetDate: ub.lastResetDate,
        isOptedIn: ub.isOptedIn,
        openedDate: card.openedDate,
      })
    }
  }
  const benefitAlerts = computeBenefitAlerts(alertInputs)

  // Detect upcoming card renewals (within 60 days of anniversary)
  const cardRenewals: { cardLabel: string; annualFee: number; daysUntilRenewal: number; totalCreditValue: number }[] = []
  for (const card of userCards) {
    if (!card.openedDate || card.cardProgram.annualFee <= 0) continue
    const opened = new Date(card.openedDate)
    const nextAnniversary = new Date(now.getFullYear(), opened.getMonth(), opened.getDate())
    if (nextAnniversary <= now) {
      nextAnniversary.setFullYear(nextAnniversary.getFullYear() + 1)
    }
    const daysUntil = Math.ceil((nextAnniversary.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
    if (daysUntil <= 60) {
      const totalCreditValue = card.benefits.reduce((sum, ub) => {
        if (!ub.cardBenefit.creditAmount) return sum
        const cycle = ub.cardBenefit.creditCycle
        const annual = cycle === 'MONTHLY' ? ub.cardBenefit.creditAmount * 12
          : cycle === 'QUARTERLY' ? ub.cardBenefit.creditAmount * 4
          : ub.cardBenefit.creditAmount
        return sum + annual
      }, 0)
      cardRenewals.push({
        cardLabel: `${card.cardProgram.issuer} ${card.cardProgram.name}`,
        annualFee: card.cardProgram.annualFee,
        daysUntilRenewal: daysUntil,
        totalCreditValue,
      })
    }
  }

  const aiResponse = await generateInsights({
    summary,
    temporal,
    velocity,
    budget,
    history,
    entitySummary: entitySummary ?? undefined,
    aiLearningContext: aiLearningContext || undefined,
    goalContext: goalContext ?? undefined,
    benefitAlerts: benefitAlerts.length > 0
      ? benefitAlerts.map((a) => ({
          cardLabel: a.cardLabel,
          benefitName: a.benefitName,
          remaining: a.remaining,
          daysUntilReset: a.daysUntilReset,
          severity: a.severity,
        }))
      : undefined,
    cardRenewals: cardRenewals.length > 0 ? cardRenewals : undefined,
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

  // Store new insights with transaction references
  const insights = await Promise.all(
    aiResponse.insights.map((insight) => {
      const txRefs = attachTransactionRefs(insight, summary._refs)
      return db.insight.create({
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
          relatedTransactionIds: txRefs.relatedTransactionIds ?? undefined,
          relatedQuery: txRefs.relatedQuery ?? undefined,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      })
    })
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

  // Goal milestone detection
  await checkGoalMilestones(userId)

  return {
    insights,
    efficiencyScore: aiResponse.efficiencyScore,
    highlightStat: aiResponse.highlightStat,
  }
}

async function checkGoalMilestones(userId: string) {
  try {
    const profile = await db.userProfile.findUnique({
      where: { userId },
      select: { goalTarget: true, primaryGoal: true },
    })

    if (!profile?.goalTarget || !profile.primaryGoal) return

    const target = profile.goalTarget as { targetValue: number; currentValue?: number; description: string; startValue?: number }
    if (!target.currentValue || target.targetValue <= 0) return

    const progress = (target.currentValue / target.targetValue) * 100

    // Check for existing milestone insights to avoid duplicates
    const existingMilestones = await db.insight.findMany({
      where: { userId, type: 'goal_milestone', status: 'active' },
      select: { title: true },
    })
    const existingTitles = new Set(existingMilestones.map(i => i.title))

    const milestones = [25, 50, 75, 100]
    for (const m of milestones) {
      if (progress >= m) {
        const title = m === 100
          ? 'Goal achieved!'
          : `${m}% of your goal achieved!`
        if (existingTitles.has(title)) continue

        await db.insight.create({
          data: {
            userId,
            category: 'goal',
            type: 'goal_milestone',
            priority: 'high',
            title,
            description: m < 100
              ? `You've reached ${m}% of your target: ${target.description}. Keep going!`
              : `Congratulations \u2014 you hit your goal: ${target.description}!`,
            savingsAmount: 0,
            actionItems: '[]',
            metadata: JSON.stringify({ milestone: m }),
            contextSnapshot: '',
            expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          },
        })
      }
    }
  } catch {
    // Non-fatal — don't break insight generation if milestone check fails
  }
}
