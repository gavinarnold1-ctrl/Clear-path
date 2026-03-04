import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
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

export const metadata: Metadata = { title: 'Budgets' }

export default async function BudgetsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  // Prior 3 complete months for expected income calculation
  const prev1Start = new Date(now.getFullYear(), now.getMonth() - 3, 1)
  const prev1End = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)

  const [budgets, allExpenseTransactions, refundCandidates, incomeAgg, priorIncomeAgg, userProfile, uncategorizedCount] = await Promise.all([
    db.budget.findMany({
      where: { userId: session.userId },
      include: { category: true, annualExpense: true },
      orderBy: [{ tier: 'asc' }, { amount: 'desc' }],
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
      select: { id: true, merchant: true, amount: true, date: true, accountId: true },
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
    // User profile for expected income setting
    db.userProfile.findUnique({
      where: { userId: session.userId },
      select: { expectedMonthlyIncome: true },
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
  ])

  // Detect refund pairs and exclude refunded expenses from budget computation
  const allForPairing = [
    ...allExpenseTransactions.map((tx) => ({ id: tx.id, merchant: tx.merchant, amount: tx.amount, date: tx.date.toISOString(), accountId: tx.accountId })),
    ...refundCandidates.map((tx) => ({ id: tx.id, merchant: tx.merchant, amount: tx.amount, date: tx.date.toISOString(), accountId: tx.accountId })),
  ]
  const refundPairIds = findRefundPairs(allForPairing)
  const transactions = allExpenseTransactions.filter((tx) => !refundPairIds.has(tx.id))

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
      // Try budget's category name (if somehow category relation exists without categoryId — unlikely but safe)
      const catName = b.category?.name?.toLowerCase()
      if (catName && spentByCategoryName.has(catName)) {
        spent = spentByCategoryName.get(catName)!
        const matchedCatId = categoryNameToId.get(catName)
        if (matchedCatId) {
          resolvedCategoryId = matchedCatId
          budgetsToReconcile.push({ id: b.id, categoryId: matchedCatId })
        }
      }
      // Try budget name as category name (e.g. budget "Groceries" → category "Groceries")
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
      // Fuzzy: word-overlap match. Requires at least 2 overlapping words to prevent
      // single-word budget names (e.g. "Services") from matching unrelated categories
      // (e.g. "Financial & Legal Services").
      if (spent === 0) {
        const budgetWords = b.name.toLowerCase().split(/[\s&,]+/).filter((w) => w.length > 2)
        if (budgetWords.length >= 2) {
          for (const [catName, catSpent] of spentByCategoryName) {
            const catWords = catName.split(/[\s&,]+/).filter((w) => w.length > 2)
            if (catWords.length < 2) continue
            const overlap = budgetWords.filter((w) => catWords.some((cw) => cw === w)).length
            const shorterLen = Math.min(budgetWords.length, catWords.length)
            if (overlap >= shorterLen && overlap >= 2) {
              spent = catSpent
              const matchedCatId = categoryNameToId.get(catName)
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

  // For FIXED budgets: compute per-bill spent by matching the best transaction,
  // not summing the entire category. This prevents inflated amounts when multiple
  // bills share a category (e.g. auto + health insurance both in "Insurance").
  const claimedTxIds = new Set<string>()
  for (const b of fixed) {
    // Get candidate transactions: by categoryId first, then by name
    // Exclude annual-linked transactions — they belong to the annual plan, not fixed bills
    let candidates = b.categoryId
      ? transactions.filter((tx) => tx.categoryId === b.categoryId && !claimedTxIds.has(tx.id) && !tx.annualExpenseId)
      : []

    // Fallback: name-based matching when no categoryId or no category matches
    if (candidates.length === 0) {
      const budgetNameLower = b.name.toLowerCase()
      candidates = transactions.filter((tx) => {
        if (claimedTxIds.has(tx.id) || tx.annualExpenseId) return false
        const merchant = (tx.merchant ?? '').toLowerCase()
        return merchant.includes(budgetNameLower) || budgetNameLower.includes(merchant)
      })
    }

    if (candidates.length === 0) {
      b.spent = 0
      continue
    }

    // Priority 1: merchant name matches budget name
    const budgetNameLower = b.name.toLowerCase()
    let match = candidates.find((tx) => {
      const merchant = (tx.merchant ?? '').toLowerCase()
      return merchant.includes(budgetNameLower) || budgetNameLower.includes(merchant)
    })

    // Priority 2: closest amount to budget
    if (!match) {
      match = candidates.reduce((best, tx) =>
        Math.abs(Math.abs(tx.amount) - b.amount) < Math.abs(Math.abs(best.amount) - b.amount)
          ? tx
          : best
      )
    }

    b.spent = Math.abs(match.amount)
    claimedTxIds.add(match.id)
  }

  // Bug 3: Catch-all flexible budgets (Miscellaneous, Uncategorized, Other) absorb
  // expense transactions not claimed by any specific budget.
  const CATCHALL_NAMES = new Set(['miscellaneous', 'uncategorized', 'other', 'everything else'])
  const catchAllBudgets = flexible.filter((b) => CATCHALL_NAMES.has(b.name.toLowerCase()))
  if (catchAllBudgets.length > 0) {
    // Collect all categoryIds claimed by non-catch-all budgets
    const claimedCategoryIds = new Set<string>()
    for (const b of budgetsWithSpent) {
      if (!CATCHALL_NAMES.has(b.name.toLowerCase()) && b.categoryId) {
        claimedCategoryIds.add(b.categoryId)
      }
    }
    // Also claim categories matched by name/fuzzy in non-catch-all budgets
    for (const b of budgetsWithSpent) {
      if (CATCHALL_NAMES.has(b.name.toLowerCase())) continue
      const bNameKey = b.name.toLowerCase()
      const matchedId = categoryNameToId.get(bNameKey)
      if (matchedId) claimedCategoryIds.add(matchedId)
      if (b.category?.name) {
        const catId = categoryNameToId.get(b.category.name.toLowerCase())
        if (catId) claimedCategoryIds.add(catId)
      }
    }

    // Sum unclaimed expense spending (exclude annual-linked transactions)
    // Include both: transactions in non-budgeted categories AND transactions with no category at all
    let unclaimedSpend = 0
    for (const tx of nonAnnualTransactions) {
      if (claimedTxIds.has(tx.id)) continue
      if (!tx.categoryId || !claimedCategoryIds.has(tx.categoryId)) {
        unclaimedSpend += Math.abs(tx.amount)
      }
    }

    // Distribute to first catch-all budget (typically there's only one)
    if (unclaimedSpend > 0) {
      catchAllBudgets[0].spent = (catchAllBudgets[0].spent || 0) + unclaimedSpend
    }
  }

  // Compute unallocated flexible budget: total unbudgeted spending that isn't claimed
  // by any specific budget (fixed, flexible, or annual). The unallocated pool is implicit —
  // it's the leftover spending that no named budget covers.
  const CATCHALL_NAMES_CHECK = new Set(['miscellaneous', 'uncategorized', 'other', 'everything else'])
  const namedFlexible = flexible.filter((b) => !CATCHALL_NAMES_CHECK.has(b.name.toLowerCase()))
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
  const monthLabel = now.toLocaleString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-fjord">Budgets</h1>
        <div className="flex items-center gap-2">
          {budgets.length > 0 && <BudgetBuilderFlow hasBudgets />}
          <Link href="/budgets/new" className="btn-primary">
            + New budget
          </Link>
        </div>
      </div>

      {budgets.length === 0 ? (
        <BudgetBuilderFlow hasBudgets={false} />
      ) : (
        <>
          <TrueRemainingBanner
            income={income}
            fixedTotal={fixedTotal}
            flexibleSpent={flexibleSpent}
            annualSetAside={annualSetAside}
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

          {uncategorizedCount > 0 && (
            <UncategorizedReviewBanner count={uncategorizedCount} />
          )}

          <FixedBudgetSection budgets={fixed} transactions={transactions} />
          <FlexibleBudgetSection
            budgets={namedFlexible}
            unallocatedAmount={flexibleBudgeted - namedFlexibleTotal > 0 ? flexibleBudgeted - namedFlexibleTotal : totalUnbudgetedSpend > 0 ? totalUnbudgetedSpend : undefined}
            unallocatedSpent={catchAllBudgets.length > 0 ? catchAllBudgets[0].spent : totalUnbudgetedSpend}
            totalFlexibleBudget={flexibleBudgeted}
            totalFlexibleSpent={flexibleSpent}
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
