import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'
import MonthPicker from './MonthPicker'
import MonthlyChart from '@/components/dashboard/MonthlyChart'
import ValueTracker from '@/components/dashboard/ValueTracker'
import TrueRemainingBanner from '@/components/budgets/TrueRemainingBanner'
import GetStarted from '@/components/onboarding/GetStarted'
import { getValueSummary } from '@/lib/value-tracker'
import { getGoalContext } from '@/lib/goal-context'
import { checkRecalibration } from '@/lib/goal-recalibration'
import RecalibrationWrapper from '@/components/dashboard/RecalibrationWrapper'
import type { PrimaryGoal, GoalTarget } from '@/types'
import { computeBenefitAlerts } from '@/lib/engines/benefit-alerts'
import type { BenefitAlertInput } from '@/lib/engines/benefit-alerts'
import GoalCrossLinks from '@/components/dashboard/GoalCrossLinks'
import BudgetHealthCards from '@/components/dashboard/BudgetHealthCards'
import AttentionItems from '@/components/dashboard/AttentionItems'
import GoalProgressCard from '@/components/dashboard/GoalProgressCard'

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
  const monthLabel = startDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })

  // Previous month for comparison
  const prevStart = new Date(year, month - 1, 1)
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
      include: { category: true, annualExpense: true },
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
      select: { expectedMonthlyIncome: true, primaryGoal: true, goalTarget: true },
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
  ])

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
  const recalibration = goalTargetData && userProfile?.primaryGoal
    ? await checkRecalibration(session.userId, goalTargetData, userProfile.primaryGoal as PrimaryGoal)
    : null

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
  const trueRemaining = (userProfile?.expectedMonthlyIncome ?? monthlyIncome) - fixedTotal - flexibleSpent - annualSetAside

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
  const LIABILITY_TYPES = new Set(['CREDIT_CARD', 'MORTGAGE', 'AUTO_LOAN', 'STUDENT_LOAN'])
  const netWorth = accounts.reduce((sum, a) => {
    if (LIABILITY_TYPES.has(a.type)) return sum - Math.abs(a.balance)
    return sum + a.balance
  }, 0)

  // Over-budget items for attention section
  const overBudgetItems = flexibleBudgets
    .filter(b => b.spent > b.amount)
    .map(b => ({ name: b.category?.name ?? b.name, overBy: b.spent - b.amount }))
    .sort((a, b) => b.overBy - a.overBy)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium text-fjord">
          {session.name ? `Welcome back, ${session.name.split(' ')[0]}` : 'Overview'}
        </h1>
        <MonthPicker currentMonth={currentMonth} />
      </div>

      {/* Row 1: Goal Progress Hero */}
      {hasGoal && goalContext && userProfile?.primaryGoal ? (
        <GoalProgressCard
          goal={userProfile.primaryGoal as PrimaryGoal}
          goalLabel={goalContext.goalLabel}
          target={goalTarget}
          trueRemaining={trueRemaining}
        />
      ) : (
        <div className="card mb-6 text-center">
          <p className="text-lg font-semibold text-fjord">
            Set a goal to see your budget working toward something specific
          </p>
          <p className="mt-2 text-sm text-stone">
            A goal transforms your dashboard from a financial report into a progress tracker.
          </p>
          <Link
            href="/settings"
            className="mt-4 inline-block rounded-button bg-fjord px-6 py-2 text-sm font-medium text-snow hover:bg-midnight"
          >
            Choose your goal
          </Link>
        </div>
      )}

      {/* Row 2: True Remaining (supporting) */}
      {hasBudgets ? (
        <>
          <TrueRemainingBanner
            income={monthlyIncome}
            expectedIncome={userProfile?.expectedMonthlyIncome ?? prevIncome}
            fixedTotal={fixedTotal}
            flexibleSpent={flexibleSpent}
            flexibleBudget={flexibleBudgets.reduce((sum, b) => sum + b.amount, 0)}
            annualSetAside={annualSetAside}
          />
          {goalTarget && trueRemaining > 0 && (
            <p className="-mt-4 mb-6 px-5 text-xs text-stone">
              {userProfile?.primaryGoal === 'save_more' && `If saved, that's ${formatCurrency(trueRemaining)} closer to your savings goal this month`}
              {userProfile?.primaryGoal === 'pay_off_debt' && `${formatCurrency(trueRemaining)} available for extra debt payments`}
              {userProfile?.primaryGoal === 'spend_smarter' && 'Proof that your spending optimization is working'}
              {userProfile?.primaryGoal === 'gain_visibility' && 'Your actual spending freedom after all commitments'}
              {userProfile?.primaryGoal === 'build_wealth' && `${formatCurrency(trueRemaining)} available for wealth-building moves`}
            </p>
          )}
        </>
      ) : (
        <div className="mb-6 rounded-xl border-2 border-mist bg-frost/50 p-5">
          <p className="text-sm text-stone">
            Set up budgets to see your True Remaining — what you can actually spend.{' '}
            <Link href="/budgets/new" className="font-medium text-fjord hover:underline">
              Create a budget
            </Link>
          </p>
        </div>
      )}

      {/* Row 3: Budget Health Cards */}
      {hasBudgets && (
        <BudgetHealthCards
          fixedPaid={fixedPaidCount}
          fixedTotal={fixedBudgets.length}
          flexibleSpent={flexibleSpent}
          flexibleBudget={flexibleBudgets.reduce((sum, b) => sum + b.amount, 0)}
          flexibleUnderBudget={flexibleUnderBudget}
          primaryGoal={(userProfile?.primaryGoal as PrimaryGoal) ?? null}
          annualFundProgress={annualFundProgress}
          annualFundTotal={annualFundTotal}
          totalDebt={totalDebt}
          debtPayments={debtPayments}
          categorizationPct={categorizationPct}
          netWorth={netWorth}
        />
      )}

      {/* Row 4: Attention Items */}
      <AttentionItems
        overBudgetItems={overBudgetItems}
        recalibration={recalibration}
        benefitAlerts={benefitAlerts}
        unbudgetedSpent={unbudgetedSpent}
      />

      {/* Goal Recalibration Banner */}
      {recalibration && <RecalibrationWrapper suggestion={recalibration} />}

      {/* Income surplus insight */}
      {(() => {
        const expectedIncome = userProfile?.expectedMonthlyIncome
        if (!expectedIncome || expectedIncome <= 0 || monthlyIncome <= expectedIncome) return null
        const surplus = monthlyIncome - expectedIncome
        return (
          <div className="mb-8 rounded-xl border border-pine/30 bg-pine/5 p-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-lg">&#x1f4b0;</span>
              <div>
                <p className="text-sm font-semibold text-pine">
                  You received {formatCurrency(surplus)} more than expected this month
                </p>
                <p className="mt-1 text-sm text-stone">
                  Your actual income of {formatCurrency(monthlyIncome)} exceeded your expected monthly income of {formatCurrency(expectedIncome)}.
                </p>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Chart */}
      <div className="mb-8">
        <MonthlyChart data={chartSeries} goalMonthlySurplus={goalTarget?.monthlyNeeded} />
      </div>

      {/* Goal-driven cross-links */}
      <GoalCrossLinks
        primaryGoal={(userProfile?.primaryGoal as PrimaryGoal) ?? null}
        showMonthlyReviewCTA={now.getDate() <= 7}
      />

      {/* Value tracker — at bottom */}
      <div>
        <ValueTracker value={valueSummary} />
      </div>
    </div>
  )
}
