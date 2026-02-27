/**
 * Refund detection — identifies expense/refund pairs by matching:
 * - Same merchant (case-insensitive)
 * - Same absolute amount
 * - Opposite signs (expense < 0, refund > 0)
 * - Within 30 days of each other
 *
 * Returns a Set of transaction IDs that are part of a refund pair
 * (both the original expense and the refund).
 */

interface RefundCandidate {
  id: string
  merchant: string
  amount: number
  date: string | Date
}

/**
 * Given a list of ALL transactions (both positive and negative),
 * find refund pairs and return the IDs of both sides.
 */
export function findRefundPairs(transactions: RefundCandidate[]): Set<string> {
  const paired = new Set<string>()
  const WINDOW_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

  // Split into expenses (negative) and potential refunds (positive)
  const expenses = transactions.filter((tx) => tx.amount < 0)
  const refunds = transactions.filter((tx) => tx.amount > 0)

  // Index refunds by merchant+amount key for fast lookup
  const refundMap = new Map<string, RefundCandidate[]>()
  for (const r of refunds) {
    const key = `${r.merchant.toLowerCase().trim()}|${Math.abs(r.amount).toFixed(2)}`
    const arr = refundMap.get(key) ?? []
    arr.push(r)
    refundMap.set(key, arr)
  }

  // Track which refund IDs have already been paired
  const usedRefundIds = new Set<string>()

  for (const exp of expenses) {
    const key = `${exp.merchant.toLowerCase().trim()}|${Math.abs(exp.amount).toFixed(2)}`
    const candidates = refundMap.get(key)
    if (!candidates) continue

    const expDate = new Date(exp.date).getTime()

    // Find the closest refund within the 30-day window that hasn't been used
    let bestMatch: RefundCandidate | null = null
    let bestDist = Infinity

    for (const c of candidates) {
      if (usedRefundIds.has(c.id)) continue
      const dist = Math.abs(new Date(c.date).getTime() - expDate)
      if (dist <= WINDOW_MS && dist < bestDist) {
        bestMatch = c
        bestDist = dist
      }
    }

    if (bestMatch) {
      paired.add(exp.id)
      paired.add(bestMatch.id)
      usedRefundIds.add(bestMatch.id)
    }
  }

  return paired
}

/**
 * Given expense transactions only, and a set of refund-paired IDs,
 * return the IDs of expenses that should be excluded from spending.
 */
export function getRefundedExpenseIds(
  expenseTransactions: { id: string }[],
  refundPairIds: Set<string>,
): Set<string> {
  const excluded = new Set<string>()
  for (const tx of expenseTransactions) {
    if (refundPairIds.has(tx.id)) excluded.add(tx.id)
  }
  return excluded
}
