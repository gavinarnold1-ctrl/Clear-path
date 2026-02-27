/**
 * Refund detection — identifies expense/refund pairs by matching:
 * - Same merchant (case-insensitive)
 * - Amount within 20% tolerance
 * - Opposite signs (expense < 0, refund > 0)
 * - Within 30 days of each other
 * - Merchant is NOT a financial institution / payment processor
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
  // Check patterns
  for (const pattern of PAYMENT_MERCHANT_PATTERNS) {
    if (lower.includes(pattern)) return true
  }
  // Check known bank/financial institution names
  for (const bank of KNOWN_BANK_NAMES) {
    if (lower.includes(bank)) return true
  }
  return false
}

/**
 * Given a list of ALL transactions (both positive and negative),
 * find refund pairs and return the IDs of both sides.
 */
export function findRefundPairs(transactions: RefundCandidate[]): Set<string> {
  const paired = new Set<string>()
  const WINDOW_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
  const AMOUNT_TOLERANCE = 0.20 // 20% tolerance

  // Split into expenses (negative) and potential refunds (positive)
  const expenses = transactions.filter((tx) => tx.amount < 0)
  const refunds = transactions.filter((tx) => tx.amount > 0 && !isPaymentOrTransferMerchant(tx.merchant))

  // Index refunds by merchant for lookup
  const refundByMerchant = new Map<string, RefundCandidate[]>()
  for (const r of refunds) {
    const key = r.merchant.toLowerCase().trim()
    const arr = refundByMerchant.get(key) ?? []
    arr.push(r)
    refundByMerchant.set(key, arr)
  }

  // Track which refund IDs have already been paired
  const usedRefundIds = new Set<string>()

  for (const exp of expenses) {
    const merchantKey = exp.merchant.toLowerCase().trim()
    const candidates = refundByMerchant.get(merchantKey)
    if (!candidates) continue

    const expDate = new Date(exp.date).getTime()
    const expAmount = Math.abs(exp.amount)

    // Find the closest refund within the 30-day window that hasn't been used
    let bestMatch: RefundCandidate | null = null
    let bestDist = Infinity

    for (const c of candidates) {
      if (usedRefundIds.has(c.id)) continue

      // Amount must be within 20% tolerance
      const refundAmount = Math.abs(c.amount)
      const amountDiff = Math.abs(refundAmount - expAmount) / expAmount
      if (amountDiff > AMOUNT_TOLERANCE) continue

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
