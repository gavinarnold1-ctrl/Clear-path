import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import MonthPicker from './MonthPicker'
import MonthlyChart from '@/components/dashboard/MonthlyChartLazy'
import ValueTracker from '@/components/dashboard/ValueTracker'
import TrueRemainingBanner from '@/components/budgets/TrueRemainingBanner'
import GetStarted from '@/components/onboarding/GetStarted'
import { getValueSummary } from '@/lib/value-tracker'
import { getGoalContext } from '@/lib/goal-context'
import { checkRecalibration } from '@/lib/goal-recalibration'
import { persistGoalCurrentValue } from '@/lib/goal-utils'
import RecalibrationWrapper from '@/components/dashboard/RecalibrationWrapper'
import type { PrimaryGoal, GoalTarget, IncomeTransition } from '@/types'
import { updateGoalPaceStatus } from '@/lib/ai-context'
import { computeTrueRemaining } from '@/lib/true-remaining'
import { computeBenefitAlerts } from '@/lib/engines/benefit-alerts'
import type { BenefitAlertInput } from '@/lib/engines/benefit-alerts'
import BudgetHealthCards from '@/components/dashboard/BudgetHealthCards'
import AttentionItems from '@/components/dashboard/AttentionItems'
import GoalProgressCard from '@/components/dashboard/GoalProgressCard'
import BackgroundSyncTrigger from '@/components/dashboard/BackgroundSyncTrigger'

export const metadata: Metadata = { title: 'Overview' }
export const revalidate = 60

interface Props {
  searchParams: Promise<{ month?: string }>
}

export default async function DashboardPage({ searchParams }: Props) {
  const session = await getSession()
  if (!session) redirect('/login')

  const params = await searchParams

  // Parse month from search params or default to current month
  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth() // 0-indexed
  if (params.month) {
    const [y, m] = params.month.split('-').map(Number)
    if (y && m && m >= 1 && m <= 12) {
      year = y
      month = m - 1
    }
  }

  const startDate = new Date(year, month, 1)
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999)

  // Previous 3 months for income averaging (matches budgets page logic)
  const prevStart = new Date(year, month - 3, 1)
  const prevEnd = new Date(year, month, 0, 23, 59, 59, 999)

  // Compute 6-month range for chart (ending at selected month)
  const chartStart = new Date(year, month - 5, 1)

  // Use amount sign as the source of truth for income vs expense.
  // The server action guarantees: income = positive, expense = negative.
  // This is more reliable than relational category-type filters, which
  // break if a category's type is wrong or missing.
  const [
    accounts,
    incomeAgg,
    expenseAgg,
    prevIncomeAgg,
    _prevExpenseAgg,
    _recent,
    rawBudgets,
    budgetExpenses,
    _categorySpending,
    chartData,
    userProfile,
    valueSummary,
    goalContext,
    debtSummary,
    txCategorizationStats,
    propertiesForNW,
    linkedAccountLinks,
  ] = await Promise.all([
    db.account.findMany({ where: { userId: session.userId } }),
    // R1.14: Income = classification "income"
    db.transaction.aggregate({
      where: {
        userId: session.userId,
        date: { gte: startDate, lte: endDate },
        classification: 'income',
      },
      _sum: { amount: true },
    }),
    // R1.14: Expenses = classification "expense" (excludes transfers)
    db.transaction.aggregate({
      where: {
        userId: session.userId,
        date: { gte: startDate, lte: endDate },
        classification: 'expense',
      },
      _sum: { amount: true },
    }),
    // Previous month income (exclude transfers)
    db.transaction.aggregate({
      where: {
        userId: session.userId,
        date: { gte: prevStart, lte: prevEnd },
        classification: 'income',
      },
      _sum: { amount: true },
    }),
    // Previous month expenses (exclude transfers)
    db.transaction.aggregate({
      where: {
        userId: session.userId,
        date: { gte: prevStart, lte: prevEnd },
        classification: 'expense',
      },
      _sum: { amount: true },
    }),
    db.transaction.findMany({
      where: { userId: session.userId },
      include: { account: true, category: true },
      orderBy: { date: 'desc' },
      take: 5,
    }),
    db.budget.findMany({
      where: {
        userId: session.userId,
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      select: {
        id: true,
        name: true,
        amount: true,
        tier: true,
        period: true,
        startDate: true,
        endDate: true,
        categoryId: true,
        category: {
          select: { id: true, name: true, group: true },
        },
        annualExpense: {
          select: {
            id: true,
            annualAmount: true,
            monthlySetAside: true,
            funded: true,
          },
        },
      },
    }),
    // Current month expense transactions for live budget spent computation (exclude transfers)
    db.transaction.findMany({
      where: {
        userId: session.userId,
        date: { gte: startDate, lte: endDate },
        classification: 'expense',
        amount: { lt: 0 },
      },
      select: { categoryId: true, amount: true, annualExpenseId: true, category: { select: { id: true, name: true } } },
    }),
    // Spending breakdown by category (expenses only, no transfers)
    db.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId: session.userId,
        date: { gte: startDate, lte: endDate },
        classification: 'expense',
        amount: { lt: 0 },
        categoryId: { not: null },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'asc' } },
      take: 6,
    }),
    // Monthly aggregates for chart (last 6 months, excluding transfers)
    db.transaction.findMany({
      where: {
        userId: session.userId,
        date: { gte: chartStart, lte: endDate },
        classification: { not: 'transfer' },
      },
      select: { date: true, amount: true, classification: true },
    }),
    // User profile for expected income + goal target
    db.userProfile.findUnique({
      where: { userId: session.userId },
      select: { expectedMonthlyIncome: true, primaryGoal: true, goalTarget: true, incomeTransitions: true },
    }),
    // Value tracker — cumulative savings identified by AI insights
    getValueSummary(session.userId),
    // Goal context for goal-driven dashboard
    getGoalContext(session.userId),
    // Debt summary for archetype card
    db.debt.aggregate({
      where: { userId: session.userId },
      _sum: { currentBalance: true, minimumPayment: true },
    }),
    // Categorization stats for gain_visibility archetype
    Promise.all([
      db.transaction.count({ where: { userId: session.userId, date: { gte: startDate, lte: endDate }, amount: { lt: 0 } } }),
      db.transaction.count({ where: { userId: session.userId, date: { gte: startDate, lte: endDate }, amount: { lt: 0 }, categoryId: { not: null } } }),
    ]),
    // Properties for net worth (equity = currentValue - loanBalance)
    db.property.findMany({
      where: { userId: session.userId },
      select: { id: true, currentValue: true, loanBalance: true },
    }),
    // Linked accounts (property-linked) to exclude from direct balance sum
    db.accountPropertyLink.findMany({
      where: { account: { userId: session.userId } },
      select: { accountId: true },
    }),
  ])

  // Plaid staleness check — type-based thresholds for sync priority
  // Credit cards need fresher data than mortgages
  const STALENESS_THRESHOLDS: Record<string, number> = {
    CREDIT_CARD: 2 * 60 * 60 * 1000,      // 2 hours
    CHECKING: 4 * 60 * 60 * 1000,          // 4 hours
    SAVINGS: 12 * 60 * 60 * 1000,          // 12 hours
    CASH: 12 * 60 * 60 * 1000,             // 12 hours
    INVESTMENT: 24 * 60 * 60 * 1000,       // 24 hours
    MORTGAGE: 7 * 24 * 60 * 60 * 1000,     // 7 days
    AUTO_LOAN: 7 * 24 * 60 * 60 * 1000,    // 7 days
    STUDENT_LOAN: 7 * 24 * 60 * 60 * 1000, // 7 days
  }
  const DEFAULT_STALE_MS = 4 * 60 * 60 * 1000 // 4 hours default
  const plaidAccounts = accounts.filter(a => a.plaidItemId)

  // Group by itemId, track most aggressive staleness threshold per item
  const itemGroups = new Map<string, { lastSynced: Date | null; minThreshold: number }>()
  for (const account of plaidAccounts) {
    const itemId = account.plaidItemId!
    const threshold = STALENESS_THRESHOLDS[account.type] ?? DEFAULT_STALE_MS
    const existing = itemGroups.get(itemId)
    if (!existing) {
      itemGroups.set(itemId, { lastSynced: account.plaidLastSynced, minThreshold: threshold })
    } else {
      // Use the oldest (most stale) sync time and most aggressive threshold
      if (!account.plaidLastSynced || (existing.lastSynced && account.plaidLastSynced < existing.lastSynced)) {
        existing.lastSynced = account.plaidLastSynced
      }
      existing.minThreshold = Math.min(existing.minThreshold, threshold)
    }
  }
  const staleItemIds: string[] = []
  const allPlaidItemIds: string[] = []
  let oldestSyncTime: Date | null = null
  for (const [itemId, { lastSynced, minThreshold }] of itemGroups) {
    allPlaidItemIds.push(itemId)
    if (!lastSynced || (now.getTime() - lastSynced.getTime()) > minThreshold) {
      staleItemIds.push(itemId)
    }
    if (lastSynced && (!oldestSyncTime || lastSynced < oldestSyncTime)) {
      oldestSyncTime = lastSynced
    }
  }

  // Check for accounts with repeated sync failures
  const syncFailingAccounts = accounts.filter(a => (a.syncFailCount ?? 0) >= 3)

  // Count unidentified credit cards for dashboard nudge
  const unidentifiedCards = await db.account.count({
    where: {
      userId: session.userId,
      type: 'CREDIT_CARD',
      userCard: null,
    },
  })

  // Benefit alerts — expiring card credits
  const userCards = await db.userCard.findMany({
    where: { userId: session.userId, isActive: true },
    select: {
      id: true,
      openedDate: true,
      cardProgram: { select: { issuer: true, name: true } },
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
  })

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

  // Check if goal needs recalibration
  const goalTargetData = userProfile?.goalTarget as GoalTarget | null
  const profileTransitions = (userProfile?.incomeTransitions as IncomeTransition[] | null) ?? undefined
  const recalibration = goalTargetData && userProfile?.primaryGoal
    ? await checkRecalibration(session.userId, goalTargetData, userProfile.primaryGoal as PrimaryGoal, profileTransitions)
    : null

  // Update AI context with goal pace status (fire-and-forget)
  if (goalTargetData) {
    const paceStatus = recalibration ? 'behind' as const : 'on_track' as const
    updateGoalPaceStatus(session.userId, paceStatus).catch(() => {})
    persistGoalCurrentValue(session.userId).catch(() => {})
  }

  // New users with no accounts: show streamlined "Get Started" flow
  if (accounts.length === 0) {
    return <GetStarted />
  }

  // Compute live budget spent from current-month expense transactions.
  // Annual-plan-linked transactions are excluded from ALL budget tiers
  // to prevent double-counting (they are tracked on the annual plan itself).
  // Additionally, transactions in annual-tier budget categories are excluded
  // even if not yet linked to an annual expense (prevents leakage).
  const annualCategoryIds = new Set(
    rawBudgets
      .filter((b) => b.tier === 'ANNUAL' && b.categoryId)
      .map((b) => b.categoryId!)
  )
  const budgetSpentMap = new Map<string, number>()
  const spentByCatName = new Map<string, number>()
  const catNameToIdMap = new Map<string, string>()
  for (const tx of budgetExpenses) {
    if (tx.annualExpenseId) continue // annual-linked → tracked on annual plan only
    if (annualCategoryIds.has(tx.categoryId ?? '')) continue // annual-tier category → exclude
    if (tx.categoryId) {
      budgetSpentMap.set(tx.categoryId, (budgetSpentMap.get(tx.categoryId) ?? 0) + Math.abs(tx.amount))
    }
    if (tx.category?.name) {
      const nameKey = tx.category.name.toLowerCase()
      spentByCatName.set(nameKey, (spentByCatName.get(nameKey) ?? 0) + Math.abs(tx.amount))
      if (tx.categoryId) catNameToIdMap.set(nameKey, tx.categoryId)
    }
  }

  const allBudgetsWithSpent = rawBudgets.map((b) => {
    // Primary: match by categoryId
    let spent = b.categoryId ? (budgetSpentMap.get(b.categoryId) ?? 0) : 0

    // TODO: V1.1 — remove fuzzy name matching once all budgets have categoryId
    // Fallback: match by category/budget name when categoryId is null
    if (spent === 0 && !b.categoryId) {
      const catName = b.category?.name?.toLowerCase()
      if (catName && spentByCatName.has(catName)) {
        spent = spentByCatName.get(catName)!
      } else {
        const budgetNameKey = b.name.toLowerCase()
        spent = spentByCatName.get(budgetNameKey) ?? 0
      }
    }

    return { ...b, spent }
  })

  // Unbudgeted spending: transactions in categories not covered by any budget
  const budgetedCategoryIds = new Set(
    rawBudgets.map((b) => b.categoryId).filter(Boolean) as string[]
  )
  const unbudgetedSpent = budgetExpenses
    .filter(
      (tx) =>
        !tx.annualExpenseId &&
        !annualCategoryIds.has(tx.categoryId ?? '') &&
        tx.categoryId &&
        !budgetedCategoryIds.has(tx.categoryId)
    )
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0)

  // True Remaining computation: income - fixed committed - flexible spent - annual set-asides
  const fixedBudgets = allBudgetsWithSpent.filter((b) => b.tier === 'FIXED')
  const flexibleBudgets = allBudgetsWithSpent.filter((b) => b.tier === 'FLEXIBLE')
  const annualBudgets = allBudgetsWithSpent.filter((b) => b.tier === 'ANNUAL')

  const monthlyIncome = incomeAgg._sum.amount ?? 0
  const fixedTotal = fixedBudgets.reduce((sum, b) => sum + b.amount, 0)
  const flexibleSpent = flexibleBudgets.reduce((sum, b) => sum + b.spent, 0)
  const annualSetAside = annualBudgets.reduce((sum, b) => sum + (b.annualExpense?.monthlySetAside ?? 0), 0)

  const prevIncome = prevIncomeAgg._sum.amount ?? 0

  // Build chart data - group transactions by month
  const chartMonths: Record<string, { income: number; expenses: number }> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, month - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    chartMonths[key] = { income: 0, expenses: 0 }
  }
  for (const tx of chartData) {
    const d = new Date(tx.date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (chartMonths[key]) {
      if (tx.classification === 'income') {
        chartMonths[key].income += Math.abs(tx.amount)
      } else if (tx.classification === 'expense') {
        chartMonths[key].expenses += Math.abs(tx.amount)
      }
      // transfers already excluded by query, but skip them if present
    }
  }
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const chartSeries = Object.entries(chartMonths)
    .map(([key, vals]) => {
      const [, m] = key.split('-')
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      return {
        label: monthNames[parseInt(m, 10) - 1],
        income: Math.round(vals.income * 100) / 100,
        expenses: Math.round(vals.expenses * 100) / 100,
        isCurrent: key === currentMonthKey,
      }
    })
    .filter((entry) => entry.income > 0 || entry.expenses > 0 || entry.isCurrent)

  const currentMonth = `${year}-${String(month + 1).padStart(2, '0')}`

  const hasBudgets = rawBudgets.length > 0

  // Goal target for goal-driven dashboard
  const goalTarget = userProfile?.goalTarget as GoalTarget | null
  const hasGoal = !!goalContext && !!userProfile?.primaryGoal
  // True Remaining: use expectedMonthlyIncome if set; fall back to 3-month avg (matching budgets page)
  const autoExpectedIncome = prevIncome / 3
  const displayIncome = userProfile?.expectedMonthlyIncome ?? (autoExpectedIncome > 0 ? autoExpectedIncome : monthlyIncome)
  const trueRemaining = computeTrueRemaining({ income: displayIncome, fixedTotal, flexibleSpent, unbudgetedSpent, annualSetAside })

  // Budget health card data
  const fixedPaidCount = fixedBudgets.filter(b => b.spent > 0).length
  const flexibleUnderBudget = Math.max(0, flexibleBudgets.reduce((sum, b) => sum + b.amount, 0) - flexibleSpent)

  // Archetype-specific card data
  const totalDebt = debtSummary._sum.currentBalance ?? 0
  const debtPayments = debtSummary._sum.minimumPayment ?? 0
  const annualFundTotal = annualBudgets.reduce((sum, b) => sum + (b.annualExpense?.annualAmount ?? 0), 0)
  const annualFundProgress = annualBudgets.reduce((sum, b) => sum + (b.annualExpense?.funded ?? 0), 0)
  const [totalExpenseTxs, categorizedTxs] = txCategorizationStats
  const categorizationPct = totalExpenseTxs > 0 ? Math.round((categorizedTxs / totalExpenseTxs) * 100) : 100
  // Net worth calculation — matches AccountManager logic exactly:
  // 1. Exclude accounts linked to properties (captured in property equity)
  // 2. Subtract liabilities
  // 3. Add property equity (currentValue - loanBalance)
  const LIABILITY_TYPES = new Set(['CREDIT_CARD', 'MORTGAGE', 'AUTO_LOAN', 'STUDENT_LOAN'])
  const linkedAccountIdSet = new Set(linkedAccountLinks.map(l => l.accountId))
  const propertyEquity = propertiesForNW.reduce((sum, p) => sum + (p.currentValue ?? 0) - (p.loanBalance ?? 0), 0)
  const accountBalance = accounts.reduce((sum, a) => {
    if (linkedAccountIdSet.has(a.id)) return sum // Handled in property equity
    if (LIABILITY_TYPES.has(a.type)) return sum - Math.abs(a.balance)
    return sum + a.balance
  }, 0)
  const netWorth = accountBalance + propertyEquity

  // Check for stale account data (any Plaid account >24h since last sync)
  const STALE_DISPLAY_MS = 24 * 60 * 60 * 1000 // 24 hours
  const staleAccounts = plaidAccounts.filter(a =>
    !a.plaidLastSynced || (now.getTime() - a.plaidLastSynced.getTime()) > STALE_DISPLAY_MS
  )
  const hasStaleBalances = staleAccounts.length > 0

  // Over-budget items for attention section
  const overBudgetItems = flexibleBudgets
    .filter(b => b.spent > b.amount)
    .map(b => ({ name: b.category?.name ?? b.name, overBy: b.spent - b.amount }))
    .sort((a, b) => b.overBy - a.overBy)

  const primaryGoal = (userProfile?.primaryGoal as PrimaryGoal) ?? null
  const flexibleBudgetTotal = flexibleBudgets.reduce((sum, b) => sum + b.amount, 0)

  return (
    <div>
      <BackgroundSyncTrigger
        staleItemIds={staleItemIds}
        allItemIds={allPlaidItemIds}
        oldestSyncTime={oldestSyncTime?.toISOString() ?? null}
        syncFailingAccountNames={syncFailingAccounts.map(a => a.name)}
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-medium text-fjord">
          {session.name ? `Welcome back, ${session.name.split(' ')[0]}` : 'Overview'}
        </h1>
        <MonthPicker currentMonth={currentMonth} />
      </div>

      {/* Row 1: Hero — True Remaining + Goal Progress side by side */}
      {hasBudgets ? (
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <Link href="/budgets" className="block lg:col-span-7 rounded-card cursor-pointer hover:ring-1 hover:ring-pine/20 transition-all">
            <TrueRemainingBanner
              income={monthlyIncome}
              expectedIncome={displayIncome}
              fixedTotal={fixedTotal}
              flexibleSpent={flexibleSpent}
              flexibleBudget={flexibleBudgetTotal}
              annualSetAside={annualSetAside}
              unbudgetedSpent={unbudgetedSpent}
              primaryGoal={primaryGoal}
            />
          </Link>
          <div className="lg:col-span-5">
            {hasGoal && goalContext && userProfile?.primaryGoal ? (
              <Link href="/forecast" className="block rounded-card cursor-pointer hover:ring-1 hover:ring-pine/20 transition-all">
                <GoalProgressCard
                  goal={userProfile.primaryGoal as PrimaryGoal}
                  goalLabel={goalContext.goalLabel}
                  target={goalTarget}
                  trueRemaining={trueRemaining}
                />
              </Link>
            ) : (
              <div className="flex h-full flex-col justify-center rounded-card border border-mist bg-frost/30 p-4 text-center">
                <p className="text-sm font-semibold text-fjord">
                  Set a goal to track progress
                </p>
                <p className="mt-1 text-xs text-stone">
                  Your dashboard becomes a progress tracker instead of a report.
                </p>
                <Link
                  href="/settings"
                  className="mt-3 inline-block rounded-button bg-fjord px-4 py-1.5 text-xs font-medium text-snow hover:bg-midnight"
                >
                  Choose your goal
                </Link>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mb-6 rounded-card border-2 border-mist bg-frost/50 p-5">
          <p className="text-sm text-stone">
            Set up budgets to see your True Remaining — what you can actually spend.{' '}
            <Link href="/budgets/new" className="font-medium text-fjord hover:underline">
              Create a budget
            </Link>
          </p>
        </div>
      )}

      {/* Row 2: Budget Health Cards */}
      {hasBudgets && (
        <>
          <BudgetHealthCards
            fixedPaid={fixedPaidCount}
            fixedTotal={fixedBudgets.length}
            flexibleSpent={flexibleSpent}
            flexibleBudget={flexibleBudgetTotal}
            flexibleUnderBudget={flexibleUnderBudget}
            primaryGoal={primaryGoal}
            annualFundProgress={annualFundProgress}
            annualFundTotal={annualFundTotal}
            totalDebt={totalDebt}
            debtPayments={debtPayments}
            categorizationPct={categorizationPct}
            netWorth={netWorth}
            hasStaleBalances={hasStaleBalances}
            staleAccountCount={staleAccounts.length}
          />
          <div className="mb-6 -mt-4 text-right">
            <Link href="/budgets" className="text-xs font-medium text-fjord hover:underline">
              Manage budgets &rarr;
            </Link>
          </div>
        </>
      )}

      {/* Row 3: Attention Items */}
      <AttentionItems
        overBudgetItems={overBudgetItems}
        recalibration={recalibration}
        benefitAlerts={benefitAlerts}
        unbudgetedSpent={unbudgetedSpent}
        unidentifiedCards={unidentifiedCards}
      />

      {/* Goal Recalibration Banner */}
      {recalibration && <RecalibrationWrapper suggestion={recalibration} />}

      {/* Chart */}
      <div className="mb-8">
        <MonthlyChart data={chartSeries} goalMonthlySurplus={goalTarget?.monthlyNeeded} />
        <div className="mt-2 text-right">
          <Link href="/monthly-review" className="text-xs font-medium text-fjord hover:underline">
            Monthly review &rarr;
          </Link>
        </div>
      </div>

      {/* Value tracker — at bottom */}
      <div>
        <ValueTracker value={valueSummary} />
      </div>
    </div>
  )
}
