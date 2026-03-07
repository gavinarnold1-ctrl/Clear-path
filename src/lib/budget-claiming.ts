/**
 * Shared budget claiming logic.
 *
 * The claiming priority is:
 * 1. ANNUAL — transactions with annualExpenseId are exclusively claimed
 * 2. FIXED  — one transaction per budget per month, matched by exact category (then merchant fallback for unlinked budgets)
 * 3. FLEXIBLE — all transactions in budget.categoryId minus annual-claimed and fixed-claimed
 * 4. CATCH-ALL — all unclaimed transactions not in any budgeted category
 *
 * This module is used by:
 * - budgets/page.tsx (display spent values)
 * - api/budgets/[id]/transactions/route.ts (return transaction IDs)
 * - api/budgets/catch-all/transactions/route.ts (return catch-all IDs)
 */

export const CATCHALL_NAMES = new Set([
  'miscellaneous',
  'uncategorized',
  'other',
  'everything else',
])

export interface ClaimableTransaction {
  id: string
  amount: number
  merchant: string | null
  categoryId: string | null
  annualExpenseId: string | null
  category?: { id: string; name: string } | null
}

export interface ClaimableBudget {
  id: string
  name: string
  amount: number
  tier: string
  categoryId: string | null
  annualExpense?: { id: string } | null
}

export interface ClaimResult {
  /** annualExpenseId → txIds */
  annualClaimed: Map<string, string[]>
  /** budgetId → single txId (for FIXED budgets) */
  fixedClaimed: Map<string, string>
  /** Set of all transaction IDs claimed by FIXED budgets */
  fixedClaimedTxIds: Set<string>
  /** budgetId → txIds (for FLEXIBLE budgets) */
  flexibleClaimed: Map<string, string[]>
  /** unclaimed txIds (catch-all pool) */
  catchAllTxIds: string[]
  /** budgetId → spent amount */
  spentByBudget: Map<string, number>
}

/**
 * Run the full claiming pipeline on a set of budgets and transactions.
 *
 * Transactions should already be filtered to the relevant month and
 * classification (expense, amount < 0). Refund-paired transactions
 * should already be excluded.
 */
export function claimTransactions(
  budgets: ClaimableBudget[],
  transactions: ClaimableTransaction[],
): ClaimResult {
  const annualClaimed = new Map<string, string[]>()
  const fixedClaimed = new Map<string, string>()
  const fixedClaimedTxIds = new Set<string>()
  const flexibleClaimed = new Map<string, string[]>()
  const spentByBudget = new Map<string, number>()

  // ── Step 1: Separate annual-linked transactions ──
  // Any transaction with annualExpenseId is exclusively claimed by the annual plan.
  const annualTxIds = new Set<string>()
  for (const tx of transactions) {
    if (tx.annualExpenseId) {
      annualTxIds.add(tx.id)
      const list = annualClaimed.get(tx.annualExpenseId) ?? []
      list.push(tx.id)
      annualClaimed.set(tx.annualExpenseId, list)
    }
  }

  // Compute spent for ANNUAL budgets
  const annualBudgets = budgets.filter(b => b.tier === 'ANNUAL')
  for (const b of annualBudgets) {
    if (!b.annualExpense) continue
    const txIds = annualClaimed.get(b.annualExpense.id) ?? []
    let spent = 0
    for (const txId of txIds) {
      const tx = transactions.find(t => t.id === txId)
      if (tx) spent += Math.abs(tx.amount)
    }
    spentByBudget.set(b.id, spent)
  }

  // Non-annual pool — used by all other tiers
  const nonAnnualTxs = transactions.filter(tx => !annualTxIds.has(tx.id))

  // ── Step 2: FIXED claiming ──
  // Each fixed budget claims exactly one transaction per month.
  // Priority: exact categoryId → amount tiebreak.
  // Merchant-name fallback ONLY for unlinked budgets (no categoryId).
  const fixedBudgets = budgets.filter(b => b.tier === 'FIXED')

  for (const b of fixedBudgets) {
    let bestMatch: ClaimableTransaction | undefined

    if (b.categoryId) {
      // Priority 1: exact category match (source of truth for linked budgets)
      const categoryMatches = nonAnnualTxs.filter(
        tx => tx.categoryId === b.categoryId && !fixedClaimedTxIds.has(tx.id),
      )
      if (categoryMatches.length > 0) {
        bestMatch = categoryMatches.reduce((best, tx) =>
          Math.abs(Math.abs(tx.amount) - b.amount) <
          Math.abs(Math.abs(best.amount) - b.amount)
            ? tx
            : best,
        )
      }
    }

    // Priority 2: merchant name fallback (ONLY for unlinked budgets)
    if (!bestMatch && !b.categoryId) {
      const budgetNameLower = b.name.toLowerCase()
      bestMatch = nonAnnualTxs.find(tx => {
        if (fixedClaimedTxIds.has(tx.id)) return false
        const merchant = (tx.merchant ?? '').toLowerCase()
        return (
          merchant.includes(budgetNameLower) ||
          budgetNameLower.includes(merchant)
        )
      })
    }

    // Priority 3: amount match (absolute last resort for unlinked budgets only)
    if (!bestMatch && !b.categoryId) {
      const unclaimed = nonAnnualTxs.filter(
        tx => !fixedClaimedTxIds.has(tx.id),
      )
      if (unclaimed.length > 0) {
        bestMatch = unclaimed.reduce((best, tx) =>
          Math.abs(Math.abs(tx.amount) - b.amount) <
          Math.abs(Math.abs(best.amount) - b.amount)
            ? tx
            : best,
        )
      }
    }

    if (bestMatch) {
      fixedClaimed.set(b.id, bestMatch.id)
      fixedClaimedTxIds.add(bestMatch.id)
      spentByBudget.set(b.id, Math.abs(bestMatch.amount))
    } else {
      spentByBudget.set(b.id, 0)
    }
  }

  // ── Step 3: FLEXIBLE claiming ──
  // Named flexible budgets claim all transactions in their category,
  // minus annual-claimed and fixed-claimed.
  const flexibleBudgets = budgets.filter(b => b.tier === 'FLEXIBLE')

  // Collect all category IDs claimed by non-catch-all budgets (for catch-all computation)
  const claimedCategoryIds = new Set<string>()
  for (const b of [...fixedBudgets, ...flexibleBudgets]) {
    if (!CATCHALL_NAMES.has(b.name.toLowerCase()) && b.categoryId) {
      claimedCategoryIds.add(b.categoryId)
    }
  }

  for (const b of flexibleBudgets) {
    if (CATCHALL_NAMES.has(b.name.toLowerCase())) continue // catch-all handled in step 4

    const txIds: string[] = []
    let spent = 0

    if (b.categoryId) {
      for (const tx of nonAnnualTxs) {
        if (tx.categoryId === b.categoryId && !fixedClaimedTxIds.has(tx.id)) {
          txIds.push(tx.id)
          spent += Math.abs(tx.amount)
        }
      }
    }

    flexibleClaimed.set(b.id, txIds)
    spentByBudget.set(b.id, spent)
  }

  // ── Step 4: Catch-all ──
  // Transactions not claimed by any budget tier and either uncategorized
  // or in a category with no budget.
  const catchAllTxIds: string[] = []
  let catchAllSpent = 0

  for (const tx of nonAnnualTxs) {
    if (fixedClaimedTxIds.has(tx.id)) continue
    if (!tx.categoryId || !claimedCategoryIds.has(tx.categoryId)) {
      catchAllTxIds.push(tx.id)
      catchAllSpent += Math.abs(tx.amount)
    }
  }

  // Assign catch-all spent to the first catch-all budget (if any)
  const catchAllBudget = flexibleBudgets.find(b =>
    CATCHALL_NAMES.has(b.name.toLowerCase()),
  )
  if (catchAllBudget) {
    flexibleClaimed.set(catchAllBudget.id, catchAllTxIds)
    spentByBudget.set(catchAllBudget.id, catchAllSpent)
  }

  return {
    annualClaimed,
    fixedClaimed,
    fixedClaimedTxIds,
    flexibleClaimed,
    catchAllTxIds,
    spentByBudget,
  }
}
