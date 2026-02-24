/**
 * Transaction classification helpers (R1.7).
 *
 * Every transaction has a classification: 'expense', 'income', or 'transfer'.
 * Transfers are excluded from spending totals, budget calculations, and Spending Breakdown.
 */

import type { TransactionClassification } from '@/types'

/** Category names that default to 'transfer' classification */
const TRANSFER_CATEGORY_NAMES = new Set([
  'transfer',
  'credit card payment',
  'credit card payments',
  'payment transfer',
  'internal transfer',
  'account transfer',
  'balance transfer',
])

/** Keywords in category names that suggest transfer */
const TRANSFER_KEYWORDS = /\b(transfer|credit card payment)\b/i

/**
 * Determine the classification for a transaction based on its category.
 *
 * Priority:
 *   1. Category name matches known transfer names → 'transfer'
 *   2. Category type = 'transfer' → 'transfer'
 *   3. Category type = 'income' → 'income'
 *   4. Everything else → 'expense'
 */
export function classifyTransaction(
  categoryName: string | null | undefined,
  categoryType: string | null | undefined
): TransactionClassification {
  if (categoryName) {
    const nameLower = categoryName.toLowerCase().trim()
    if (TRANSFER_CATEGORY_NAMES.has(nameLower) || TRANSFER_KEYWORDS.test(nameLower)) {
      return 'transfer'
    }
  }

  if (categoryType === 'transfer') return 'transfer'
  if (categoryType === 'income') return 'income'

  return 'expense'
}
