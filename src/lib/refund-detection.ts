/**
 * Refund detection — identifies expense/refund pairs by matching:
 * - Same account (both transactions on the same account)
 * - Exact amount match (no tolerance — V1 simplicity)
 * - Opposite signs (expense < 0, refund > 0)
 * - Within 30 days of each other
 * - Refund is NOT a payment/transfer merchant
 *
 * Returns a Set of transaction IDs that are part of a refund pair
 * (both the original expense and the refund).
 */

interface RefundCandidate {
  id: string
  merchant: string
  amount: number
  date: string | Date
  accountId?: string | null
}

/**
 * Exclusion patterns for merchants that are payment processors, banks, or transfer services.
 * Credit card payments, bank transfers, ACH transfers, and loan payments should never be flagged as refunds.
 */
const PAYMENT_MERCHANT_PATTERNS = [
  'payment',
  'credit card',
  'bank',
  'transfer',
  'ach',
  'autopay',
  'loan payment',
  'payoff',
  'paydown',
  'wire',
  'zelle',
  'venmo',
  'paypal',
  'cash app',
] as const

const KNOWN_BANK_NAMES = [
  'chase',
  'wells fargo',
  'bank of america',
  'citibank',
  'citi',
  'capital one',
  'discover',
  'american express',
  'amex',
  'usaa',
  'ally',
  'marcus',
  'sofi',
  'td bank',
  'pnc',
  'us bank',
  'truist',
  'huntington',
  'regions',
  'fifth third',
  'citizens',
  'navient',
  'nelnet',
  'fedloan',
  'sallie mae',
  'great lakes',
] as const

function isPaymentOrTransferMerchant(merchant: string): boolean {
  const lower = merchant.toLowerCase().trim()
  for (const pattern of PAYMENT_MERCHANT_PATTERNS) {
    if (lower.includes(pattern)) return true
  }
  for (const bank of KNOWN_BANK_NAMES) {
    if (lower.includes(bank)) return true
  }
  return false
}

/**
 * Given a list of ALL transactions (both positive and negative),
 * find refund pairs and return the IDs of both sides.
 *
 * Algorithm: same account + exact amount + opposite direction + within 30 days.
 * Merchant matching is NOT required — refunds often show a different merchant name
 * (e.g., "REFUND FROM STORE" vs "STORE #1234").
 */
export function findRefundPairs(transactions: RefundCandidate[]): Set<string> {
  const paired = new Set<string>()
  const WINDOW_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

  // Split into expenses (negative) and potential refunds (positive, not payment/transfer)
  const expenses = transactions.filter((tx) => tx.amount < 0)
  const refunds = transactions.filter((tx) => tx.amount > 0 && !isPaymentOrTransferMerchant(tx.merchant))

  // Index refunds by accountId + absolute amount for fast lookup
  const refundIndex = new Map<string, RefundCandidate[]>()
  for (const r of refunds) {
    if (!r.accountId) continue // Skip transactions without account — can't match
    const key = `${r.accountId}:${Math.abs(r.amount).toFixed(2)}`
    const arr = refundIndex.get(key) ?? []
    arr.push(r)
    refundIndex.set(key, arr)
  }

  // Track which refund IDs have already been paired
  const usedRefundIds = new Set<string>()

  for (const exp of expenses) {
    if (!exp.accountId) continue // Skip transactions without account
    const key = `${exp.accountId}:${Math.abs(exp.amount).toFixed(2)}`
    const candidates = refundIndex.get(key)
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
