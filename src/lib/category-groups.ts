/**
 * Category group inference and transaction classification.
 *
 * Uses the canonical reference data from `src/lib/reference/category-groups.ts`
 * as the single source of truth for group keywords.
 */

import { suggestGroup } from '@/lib/reference/category-groups'

/**
 * Infer the best-fit category group for a given category name.
 * Returns a real group name — never "Imported".
 *
 * Delegates to the canonical reference data in `suggestGroup()`.
 */
export function inferCategoryGroup(categoryName: string, categoryType: string): string {
  return suggestGroup(categoryName, categoryType)
}

/**
 * Derive transaction classification from category group + amount.
 *
 * Hierarchy (deterministic once every category is in the right group):
 *   1. Group is "Transfer" or "Transfers"  → 'transfer'
 *   2. Group is "Income" + positive amount → 'income'
 *   3. Group is "Income" + non-positive    → 'expense'  (e.g. tax withholding)
 *   4. Everything else                     → 'expense'
 *
 * When no category/group is available, falls back to category.type, then amount sign.
 */
export function classifyTransaction(
  group: string | null | undefined,
  categoryType: string | null | undefined,
  amount: number,
): string {
  // Group-based classification (primary)
  if (group) {
    const g = group.toLowerCase()
    if (g === 'transfer' || g === 'transfers') return 'transfer'
    if (g === 'income') return amount > 0 ? 'income' : 'expense'
  }

  // Fallback: category type (when group is missing or "Other")
  if (categoryType === 'transfer') return 'transfer'
  if (categoryType === 'income') return amount > 0 ? 'income' : 'expense'

  return 'expense'
}
