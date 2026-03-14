import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import TrueRemainingBanner from '@/components/budgets/TrueRemainingBanner'
import BudgetHealth from '@/components/budgets/BudgetHealth'
import FixedBudgetSection from '@/components/budgets/FixedBudgetSection'
import FlexibleBudgetSection from '@/components/budgets/FlexibleBudgetSection'
import AnnualBudgetSection from '@/components/budgets/AnnualBudgetSection'
import BudgetBuilderFlow from '@/components/budget-builder/BudgetBuilderFlow'
import UnbudgetedSection from '@/components/budgets/UnbudgetedSection'
import UncategorizedReviewBanner from '@/components/budgets/UncategorizedReviewBanner'
import { findRefundPairs } from '@/lib/refund-detection'
import { getGoalContext } from '@/lib/goal-context'
import { formatCurrency } from '@/lib/utils'
import { getTrueRemainingData } from '@/lib/true-remaining'
import { getBudgetBenchmarks, aggregateByGroup } from '@/lib/budget-benchmarks'
import BenchmarkBar from '@/components/budgets/BenchmarkBar'
import type { GoalTarget } from '@/types'
import { claimTransactions, CATCHALL_NAMES } from '@/lib/budget-claiming'
import type { ClaimableTransaction } from '@/lib/budget-claiming'
import BudgetMonthSelector from '@/components/budgets/BudgetMonthSelector'

export const metadata: Metadata = { title: 'Budgets' }

interface PageProps {
  searchParams: Promise<{ month?: string }>
}

export default async function BudgetsPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')

  const params = await searchParams
  const monthParam = params.month ?? ''

  const now = new Date()
  const target = monthParam
    ? new Date(parseInt(monthParam.split('-')[0]), parseInt(monthParam.split('-')[1]) - 1, 1)
    : now
  const startOfMonth = new Date(target.getFullYear(), target.getMonth(), 1)
  const endOfMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0, 23, 59, 59, 999)
  const currentMonthStr = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`

  // Prior 3 complete months for expected income calculation
  const prev1Start = new Date(now.getFullYear(), now.getMonth() - 3, 1)
  const prev1End = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)

  const [budgets, allExpenseTransactions, refundCandidates, incomeAgg, priorIncomeAgg, userProfile, uncategorizedCount, goalContext, oldestTx] = await Promise.all([
    db.budget.findMany({
      where: { userId: session.userId },
      include: { category: true, annualExpense: true, _count: { select: { overrideTransactions: true } } },
      orderBy: [{ tier: 'asc' }, { sortOrder: 'asc' }, { amount: 'desc' }],
    }),
    // Current month's expense transactions — exclude transfers for budget computation
    db.transaction.findMany({
      where: {
        userId: session.userId,
        date: { gte: startOfMonth, lte: endOfMonth },
        classification: 'expense',
        amount: { lt: 0 },
      },
      include: { category: { select: { id: true, name: true } } },
    }),
    // Potential refunds: positive-amount transactions in same period for refund pairing
    db.transaction.findMany({
      where: {
        userId: session.userId,
        date: { gte: startOfMonth, lte: endOfMonth },
        amount: { gt: 0 },
      },
      select: { id: true, merchant: true, amount: true, date: true, accountId: true, classification: true },
    }),
    // Current month's income for True Remaining (classification=income only)
    db.transaction.aggregate({
      where: {
        userId: session.userId,
        date: { gte: startOfMonth, lte: endOfMonth },
        classification: 'income',
      },
      _sum: { amount: true },
    }),
    // Prior 3 complete months income for expected income estimate
    db.transaction.aggregate({
      where: {
        userId: session.userId,
        date: { gte: prev1Start, lte: prev1End },
        classification: 'income',
      },
      _sum: { amount: true },
    }),
    // User profile for expected income + goal target
    db.userProfile.findUnique({
      where: { userId: session.userId },
      select: { expectedMonthlyIncome: true, primaryGoal: true, goalTarget: true, incomeRange: true },
    }),
    // Count of uncategorized transactions this month (for review banner)
    db.transaction.count({
      where: {
        userId: session.userId,
        date: { gte: startOfMonth, lte: endOfMonth },
        categoryId: null,
        amount: { lt: 0 },
      },
    }),
    // Goal context for budget-goal connection
    getGoalContext(session.userId),
    // Oldest transaction for month selector range
    db.transaction.findFirst({
      where: { userId: session.userId },
      orderBy: { date: 'asc' },
      select: { date: true },
    }),
  ])

  // Build available months list from oldest transaction to current month
  const availableMonths: string[] = []
  {
    const earliest = oldestTx?.date ?? now
    const startY = earliest.getFullYear()
    const startM = earliest.getMonth()
    const endY = now.getFullYear()
    const endM = now.getMonth()
    for (let y = endY, m = endM; y > startY || (y === startY && m >= startM); m--) {
      if (m < 0) { m = 11; y-- }
      availableMonths.push(`${y}-${String(m + 1).padStart(2, '0')}`)
    }
  }

  // Detect refund pairs and exclude refunded expenses from budget computation
  const allForPairing = [
    ...allExpenseTransactions.map((tx) => ({ id: tx.id, merchant: tx.merchant, amount: tx.amount, date: tx.date.toISOString(), accountId: tx.accountId, classification: tx.classification })),
    ...refundCandidates.map((tx) => ({ id: tx.id, merchant: tx.merchant, amount: tx.amount, date: tx.date.toISOString(), accountId: tx.accountId, classification: tx.classification })),
  ]
  const refundPairIds = findRefundPairs(allForPairing)
  const transactions = allExpenseTransactions.filter(
    (tx) => !refundPairIds.has(tx.id) && !(tx.tags && tx.tags.includes('perk_covered'))
  )

  const income = incomeAgg._sum.amount ?? 0

  // Compute spent per category from this month's expense transactions.
  // Budget spent is always computed on read — never stored.
  // Transactions linked to annual plans are excluded from ALL budget tiers
  // to prevent double-counting (they are tracked on the annual plan itself).
  const spentByCategory = new Map<string, number>()
  const spentByCategoryName = new Map<string, number>()
  for (const tx of transactions) {
    if (tx.annualExpenseId) continue // annual-linked → tracked on annual plan only
    if (tx.categoryId) {
      spentByCategory.set(
        tx.categoryId,
        (spentByCategory.get(tx.categoryId) ?? 0) + Math.abs(tx.amount)
      )
    }
    if (tx.category?.name) {
      const nameKey = tx.category.name.toLowerCase()
      spentByCategoryName.set(
        nameKey,
        (spentByCategoryName.get(nameKey) ?? 0) + Math.abs(tx.amount)
      )
    }
  }

  // Compute spent per annual expense from annual-linked transactions.
  // These are excluded from spentByCategory above to prevent double-counting.
  const spentByAnnualExpense = new Map<string, number>()
  for (const tx of transactions) {
    if (tx.annualExpenseId) {
      spentByAnnualExpense.set(
        tx.annualExpenseId,
        (spentByAnnualExpense.get(tx.annualExpenseId) ?? 0) + Math.abs(tx.amount)
      )
    }
  }

  // Auto-reconcile: if a budget has no categoryId but we can match by name,
  // permanently link it so future reads work without fallback.
  const budgetsToReconcile: { id: string; categoryId: string }[] = []
  // Build a lookup from category name → categoryId from transactions
  const categoryNameToId = new Map<string, string>()
  for (const tx of transactions) {
    if (tx.category?.name && tx.categoryId) {
      categoryNameToId.set(tx.category.name.toLowerCase(), tx.categoryId)
    }
  }

  // Validate previously reconciled categoryIds — if the budget name no longer
  // matches its linked category under the current matching rules, clear the
  // stale link so re-reconciliation can run with stricter rules.
  const budgetsToClear: string[] = []
  for (const b of budgets) {
    if (!b.categoryId || !b.category) continue
    const catNameLower = b.category.name.toLowerCase()
    const budgetNameLower = b.name.toLowerCase()
    // Keep if exact name match
    if (catNameLower === budgetNameLower) continue
    // Re-validate fuzzy: requires 2+ word overlap on both sides
    const budgetWords = budgetNameLower.split(/[\s&,]+/).filter((w) => w.length > 2)
    const catWords = catNameLower.split(/[\s&,]+/).filter((w) => w.length > 2)
    if (budgetWords.length >= 2 && catWords.length >= 2) {
      const overlap = budgetWords.filter((w) => catWords.some((cw) => cw === w)).length
      const shorterLen = Math.min(budgetWords.length, catWords.length)
      if (overlap >= shorterLen && overlap >= 2) continue // still valid
    }
    // Stale — clear it
    b.categoryId = null
    b.category = null
    budgetsToClear.push(b.id)
  }
  if (budgetsToClear.length > 0) {
    Promise.all(
      budgetsToClear.map((id) =>
        db.budget.update({ where: { id }, data: { categoryId: null } })
      )
    ).catch(() => { /* non-critical */ })
  }

  const budgetsWithSpent = budgets.map((b) => {
    // Annual tier: spent comes from transactions linked by annualExpenseId,
    // not from the category spending map (those are excluded to prevent double-counting).
    if (b.tier === 'ANNUAL' && b.annualExpense) {
      const spent = spentByAnnualExpense.get(b.annualExpense.id) ?? 0
      return { ...b, spent, resolvedCategoryId: b.categoryId }
    }

    // Primary: match by categoryId
    let spent = b.categoryId ? (spentByCategory.get(b.categoryId) ?? 0) : 0
    let resolvedCategoryId: string | null = null

    // Fallback: if no categoryId or no spent found, try matching by category/budget name.
    // SKIP all reconciliation for ANNUAL tier — annual budgets get their categoryId
    // at creation time and should never be auto-reconciled.
    if (spent === 0 && !b.categoryId && b.tier !== 'ANNUAL') {
      if (b.tier === 'FIXED') {
        // FIXED tier: exact name match only (case-insensitive)
        const budgetNameKey = b.name.toLowerCase().trim()
        if (spentByCategoryName.has(budgetNameKey)) {
          const matchedCatId = categoryNameToId.get(budgetNameKey)
          if (matchedCatId) {
            resolvedCategoryId = matchedCatId
            budgetsToReconcile.push({ id: b.id, categoryId: matchedCatId })
          }
        }
      } else {
        // FLEXIBLE tier: try exact name, then fuzzy word-overlap
        // Try budget's category name
        const catName = b.category?.name?.toLowerCase()
        if (catName && spentByCategoryName.has(catName)) {
          spent = spentByCategoryName.get(catName)!
          const matchedCatId = categoryNameToId.get(catName)
          if (matchedCatId) {
            resolvedCategoryId = matchedCatId
            budgetsToReconcile.push({ id: b.id, categoryId: matchedCatId })
          }
        }
        // Try budget name as category name
        if (spent === 0) {
          const budgetNameKey = b.name.toLowerCase()
          if (spentByCategoryName.has(budgetNameKey)) {
            spent = spentByCategoryName.get(budgetNameKey)!
            const matchedCatId = categoryNameToId.get(budgetNameKey)
            if (matchedCatId) {
              resolvedCategoryId = matchedCatId
              budgetsToReconcile.push({ id: b.id, categoryId: matchedCatId })
            }
          }
        }
        // Fuzzy: word-overlap match (flexible only)
        if (spent === 0) {
          const budgetWords = b.name.toLowerCase().split(/[\s&,]+/).filter((w) => w.length > 2)
          if (budgetWords.length >= 2) {
            for (const [catNameKey, catSpent] of spentByCategoryName) {
              const catWords = catNameKey.split(/[\s&,]+/).filter((w) => w.length > 2)
              if (catWords.length < 2) continue
              const overlap = budgetWords.filter((w) => catWords.some((cw) => cw === w)).length
              const shorterLen = Math.min(budgetWords.length, catWords.length)
              if (overlap >= shorterLen && overlap >= 2) {
                spent = catSpent
                const matchedCatId = categoryNameToId.get(catNameKey)
                if (matchedCatId) {
                  resolvedCategoryId = matchedCatId
                  budgetsToReconcile.push({ id: b.id, categoryId: matchedCatId })
                }
                break
              }
            }
          }
        }
      }
    }

    return { ...b, spent, resolvedCategoryId: resolvedCategoryId ?? b.categoryId }
  })

  // Persist reconciled categoryIds so future loads don't need fallback matching
  if (budgetsToReconcile.length > 0) {
    Promise.all(
      budgetsToReconcile.map(({ id, categoryId }) =>
        db.budget.update({ where: { id }, data: { categoryId } })
      )
    ).catch(() => { /* non-critical — silently ignore reconciliation failures */ })
  }

  const fixed = budgetsWithSpent.filter((b) => b.tier === 'FIXED')
  const flexible = budgetsWithSpent.filter((b) => b.tier === 'FLEXIBLE')
  const annual = budgetsWithSpent.filter((b) => b.tier === 'ANNUAL')

  // R6.7: Compute unbudgeted categories — expense categories with spending but no budget.
  // Match by categoryId (primary), then by exact name, then by fuzzy word overlap.
  const budgetedCategoryIds = new Set(budgets.map((b) => b.categoryId).filter(Boolean))
  // Also build a set of budgeted category names (lowercase) for fallback matching
  const budgetedCategoryNames = new Set<string>()
  for (const b of budgets) {
    if (b.category?.name) budgetedCategoryNames.add(b.category.name.toLowerCase())
    budgetedCategoryNames.add(b.name.toLowerCase())
  }
  // Build fuzzy word sets from budget names for word-overlap matching
  const budgetWordSets = budgets.map((b) => {
    const words = b.name.toLowerCase().split(/[\s&,]+/).filter((w) => w.length > 2)
    const catWords = b.category?.name?.toLowerCase().split(/[\s&,]+/).filter((w: string) => w.length > 2) ?? []
    return new Set([...words, ...catWords])
  })

  function isCategoryBudgeted(categoryId: string, categoryName: string): boolean {
    // Primary: exact categoryId match
    if (budgetedCategoryIds.has(categoryId)) return true
    // Exact name match (budget name or budget's category name)
    if (budgetedCategoryNames.has(categoryName.toLowerCase())) return true
    // Fuzzy: word-overlap match (e.g., "Travel & Vacation" ↔ "Vacation & Travel")
    // All words from the shorter name must match the longer name.
    const catWords = categoryName.toLowerCase().split(/[\s&,]+/).filter((w) => w.length > 2)
    if (catWords.length < 2) return false
    for (const wordSet of budgetWordSets) {
      if (wordSet.size < 2) continue
      const overlap = catWords.filter((w) => wordSet.has(w)).length
      const shorterLen = Math.min(catWords.length, wordSet.size)
      if (overlap >= shorterLen && overlap >= 2) return true
    }
    return false
  }

  // Transactions not linked to annual plans — used for flexible/unbudgeted calculations
  const nonAnnualTransactions = transactions.filter((tx) => !tx.annualExpenseId)

  const unbudgetedCategories: { categoryId: string; categoryName: string; spent: number }[] = []
  for (const tx of nonAnnualTransactions) {
    if (tx.categoryId && tx.category && !isCategoryBudgeted(tx.categoryId, tx.category.name)) {
      const existing = unbudgetedCategories.find((u) => u.categoryId === tx.categoryId)
      if (existing) {
        existing.spent += Math.abs(tx.amount)
      } else {
        unbudgetedCategories.push({
          categoryId: tx.categoryId,
          categoryName: tx.category.name,
          spent: Math.abs(tx.amount),
        })
      }
    }
  }
  // Sort by spend descending
  unbudgetedCategories.sort((x, y) => y.spent - x.spent)

  // Use shared claiming logic for FIXED, FLEXIBLE, and catch-all budgets.
  // This ensures the budget page, API routes, and transaction list all use
  // identical claiming priority: annual → fixed (exact category) → flexible → catch-all.
  const claimableTxs: ClaimableTransaction[] = transactions.map(tx => ({
    id: tx.id,
    amount: tx.amount,
    merchant: tx.merchant,
    categoryId: tx.categoryId,
    annualExpenseId: tx.annualExpenseId,
    budgetId: tx.budgetId,
    category: tx.category,
    tags: tx.tags,
  }))
  const claimResult = claimTransactions(budgetsWithSpent, claimableTxs)

  // Apply shared claiming results to fixed budgets
  for (const b of fixed) {
    b.spent = claimResult.spentByBudget.get(b.id) ?? 0
  }
  const claimedTxIds = claimResult.fixedClaimedTxIds

  // Apply shared claiming results to catch-all budgets
  const catchAllBudgets = flexible.filter((b) => CATCHALL_NAMES.has(b.name.toLowerCase()))
  if (catchAllBudgets.length > 0) {
    catchAllBudgets[0].spent = claimResult.spentByBudget.get(catchAllBudgets[0].id) ?? 0
  }

  // Compute unallocated flexible budget: total unbudgeted spending that isn't claimed
  // by any specific budget (fixed, flexible, or annual). The unallocated pool is implicit —
  // it's the leftover spending that no named budget covers.
  const namedFlexible = flexible.filter((b) => !CATCHALL_NAMES.has(b.name.toLowerCase()))
  const namedFlexibleTotal = namedFlexible.reduce((sum, b) => sum + b.amount, 0)
  const totalUnbudgetedSpend = unbudgetedCategories.reduce((sum, c) => sum + c.spent, 0)

  const fixedTotal = fixed.reduce((sum, b) => sum + b.amount, 0)
  const flexibleBudgeted = flexible.reduce((sum, b) => sum + b.amount, 0)
  const flexibleSpent = flexible.reduce((sum, item) => sum + item.spent, 0)
  const annualSetAside = annual.reduce((sum, b) => {
    return sum + (b.annualExpense?.monthlySetAside ?? 0)
  }, 0)

  // Budget Health metrics
  const autoExpectedIncome = (priorIncomeAgg._sum.amount ?? 0) / 3
  const expectedIncome = userProfile?.expectedMonthlyIncome ?? autoExpectedIncome
  const actualExpenses = transactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
  const expectedExpenses = fixedTotal + flexibleBudgeted + annualSetAside
  const fixedPaid = fixed.filter((b) => b.spent > 0).length
  const flexOnTrack = flexible.filter((b) => b.spent <= b.amount).length
  const flexOverBudget = flexible.filter((b) => b.spent > b.amount).length
  const monthLabel = target.toLocaleString('en-US', { month: 'long', year: 'numeric' })

  // Goal-budget connection
  const goalTarget = userProfile?.goalTarget as GoalTarget | null
  const projectedMonthlySurplus = expectedIncome - fixedTotal - flexibleBudgeted - annualSetAside

  // BLS benchmark comparisons for flexible budgets
  const categorySpendingForBenchmark = namedFlexible.map(b => ({
    categoryId: b.categoryId ?? b.id,
    categoryName: b.category?.name ?? b.name,
    categoryGroup: b.category?.group ?? '',
    spent: b.spent,
  }))
  const benchmarks = await getBudgetBenchmarks(session.userId, categorySpendingForBenchmark, userProfile?.incomeRange ?? null)
  const benchmarkMap = new Map(benchmarks.map(b => [b.categoryName, b]))

  const overBenchmarkCount = benchmarks.filter(b => b.status === 'over' || b.status === 'way_over').length
  const totalPotentialSavings = benchmarks
    .filter(b => b.delta > 0)
    .reduce((sum, b) => sum + b.delta, 0)

  // Group-level benchmark aggregation
  const groupBenchmarks = aggregateByGroup(benchmarks)

  // True Remaining — use shared function so dashboard/budgets/annual all match
  const trData = await getTrueRemainingData(session.userId, startOfMonth, endOfMonth)

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-bold text-fjord">Budgets</h1>
          {availableMonths.length > 1 && (
            <BudgetMonthSelector
              availableMonths={availableMonths}
              selectedMonth={currentMonthStr}
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          {budgets.length > 0 && <BudgetBuilderFlow hasBudgets />}
          <Button href="/budgets/new">
            + New budget
          </Button>
        </div>
      </div>

      {budgets.length === 0 ? (
        <BudgetBuilderFlow hasBudgets={false} />
      ) : (
        <>
          <TrueRemainingBanner
            income={trData.rawIncome}
            expectedIncome={trData.income}
            fixedTotal={trData.fixedTotal}
            flexibleSpent={trData.flexibleSpent}
            flexibleBudget={trData.flexibleBudget}
            annualSetAside={trData.annualSetAside}
            unbudgetedSpent={trData.unbudgetedSpent}
          />

          <BudgetHealth
            expectedIncome={expectedIncome}
            actualIncome={income}
            expectedExpenses={expectedExpenses}
            actualExpenses={actualExpenses}
            fixedPaid={fixedPaid}
            fixedTotal={fixed.length}
            flexOnTrack={flexOnTrack}
            flexTotal={flexible.length}
            flexOverBudget={flexOverBudget}
            monthLabel={monthLabel}
          />

          {/* Goal alignment banner */}
          {goalContext && goalTarget && (
            <div className={`mb-6 rounded-card border px-5 py-4 ${
              projectedMonthlySurplus >= (goalTarget.monthlyNeeded ?? 0)
                ? 'border-pine/20 bg-pine/5'
                : 'border-birch/30 bg-birch/10'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-stone">
                    {goalContext.goalLabel} — Budget alignment
                  </p>
                  <p className="mt-1 text-sm text-fjord">
                    {projectedMonthlySurplus >= (goalTarget.monthlyNeeded ?? 0) ? (
                      <>
                        Your budgets leave{' '}
                        <span className="font-semibold text-pine">{formatCurrency(projectedMonthlySurplus)}/mo</span>
                        {' '}surplus — on track to reach your goal.
                      </>
                    ) : (
                      <>
                        Your budgets leave{' '}
                        <span className="font-semibold text-ember">{formatCurrency(projectedMonthlySurplus)}/mo</span>
                        {' '}surplus. You need{' '}
                        <span className="font-medium">{formatCurrency((goalTarget.monthlyNeeded ?? 0) - projectedMonthlySurplus)}/mo</span>
                        {' '}more to stay on pace.
                      </>
                    )}
                  </p>
                </div>
                <Link href="/forecast" className="shrink-0 text-sm font-medium text-pine hover:underline">
                  Forecast →
                </Link>
              </div>
            </div>
          )}

          {uncategorizedCount > 0 && (
            <UncategorizedReviewBanner count={uncategorizedCount} />
          )}

          <FixedBudgetSection budgets={fixed} transactions={transactions} month={currentMonthStr} />
          {benchmarks.length > 0 && (
            <div className="mb-3 rounded-lg bg-frost px-3 py-2 text-xs text-stone">
              {overBenchmarkCount === 0 ? (
                <span className="font-medium text-pine">All flexible spending is at or below bracket averages</span>
              ) : (
                <span>
                  <strong className="text-ember">{overBenchmarkCount} categor{overBenchmarkCount === 1 ? 'y' : 'ies'}</strong> above your bracket average
                  {totalPotentialSavings > 0 && (
                    <> — matching benchmarks could free up <strong className="text-pine">{formatCurrency(totalPotentialSavings)}/month</strong></>
                  )}
                </span>
              )}
            </div>
          )}
          {groupBenchmarks.length > 0 && (
            <details className="mb-6">
              <summary className="cursor-pointer text-xs font-medium text-stone hover:text-fjord">
                Spending by group vs. bracket average
              </summary>
              <div className="mt-2 space-y-1.5">
                {groupBenchmarks.map(gb => (
                  <div key={gb.groupName} className="flex items-center justify-between rounded-badge bg-snow px-3 py-1.5 text-xs">
                    <span className="font-medium text-fjord">{gb.groupName}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-stone">
                        {formatCurrency(gb.userMonthlySpend)} / {formatCurrency(gb.blsMonthlyAvg)}
                      </span>
                      <span className={`rounded-badge px-1.5 py-0.5 font-medium ${
                        gb.status === 'under' ? 'bg-pine/10 text-pine'
                          : gb.status === 'at' ? 'bg-mist text-stone'
                          : gb.status === 'over' ? 'bg-birch/20 text-birch'
                          : 'bg-ember/10 text-ember'
                      }`}>
                        {gb.percentOfBenchmark}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
          <FlexibleBudgetSection
            budgets={namedFlexible}
            unallocatedAmount={flexibleBudgeted - namedFlexibleTotal > 0 ? flexibleBudgeted - namedFlexibleTotal : totalUnbudgetedSpend > 0 ? totalUnbudgetedSpend : undefined}
            unallocatedSpent={catchAllBudgets.length > 0 ? catchAllBudgets[0].spent : totalUnbudgetedSpend}
            totalFlexibleBudget={flexibleBudgeted}
            totalFlexibleSpent={flexibleSpent}
            benchmarks={benchmarks}
            primaryGoal={userProfile?.primaryGoal ?? undefined}
            hasGoalTarget={!!goalTarget}
            month={currentMonthStr}
          />
          <AnnualBudgetSection budgets={annual} />
          <UnbudgetedSection categories={unbudgetedCategories} />
          {annual.length > 0 && (
            <div className="-mt-5 mb-8 text-right">
              <Link
                href="/budgets/annual"
                className="text-xs font-medium text-fjord hover:text-midnight"
              >
                View full plan &rarr;
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}
