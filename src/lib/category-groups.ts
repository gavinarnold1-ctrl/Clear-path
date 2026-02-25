/**
 * Default category group mapping table (R1.6).
 *
 * When a CSV import creates a new category that doesn't match any existing one,
 * this table assigns it to the best-fit group based on keyword matching.
 * Never assigns to "Imported" — always picks a real group.
 */

const GROUP_KEYWORDS: Record<string, string[]> = {
  'Housing': [
    'mortgage', 'rent', 'hoa', 'property tax', 'home', 'housing',
    'improvement', 'repair', 'furniture', 'housewares', 'appliance',
  ],
  'Utilities': [
    'electric', 'gas & electric', 'water', 'garbage', 'internet',
    'cable', 'phone', 'cell', 'mobile', 'utility',
  ],
  'Food': [
    'groceries', 'grocery', 'restaurant', 'dining', 'food', 'coffee',
    'bars', 'bakery', 'takeout', 'delivery',
  ],
  'Transport': [
    'gas', 'fuel', 'auto', 'car', 'parking', 'toll',
    'uber', 'lyft', 'taxi', 'transit', 'ride share', 'public transit',
  ],
  'Insurance': [
    'insurance', 'premium', 'usaa', 'geico', 'state farm',
  ],
  'Healthcare': [
    'medical', 'doctor', 'dentist', 'pharmacy', 'hospital',
    'therapy', 'fitness', 'gym', 'health', 'wellness',
  ],
  'Personal': [
    'clothing', 'personal', 'shopping', 'electronics', 'education',
    'gifts', 'charity', 'donation', 'beauty', 'haircut',
  ],
  'Entertainment': [
    'entertainment', 'recreation', 'travel', 'vacation', 'hotel',
    'flight', 'pet', 'vet', 'streaming', 'movie', 'concert',
  ],
  'Financial': [
    'fee', 'financial', 'legal', 'loan', 'student loan',
    'bank fee', 'interest', 'atm',
  ],
  'Income': [
    'income', 'salary', 'paycheck', 'dividend', 'interest earned',
    'bonus', 'refund', 'reimbursement',
  ],
  'Transfers': [
    'transfer', 'credit card payment', 'internal transfer',
    'zelle', 'venmo', 'paypal',
  ],
  'Other': [
    'miscellaneous', 'uncategorized', 'cash', 'postage', 'shipping',
    'tax', 'office', 'wedding', 'business',
  ],
}

/**
 * Infer the best-fit category group for a given category name.
 * Returns a real group name — never "Imported".
 */
export function inferCategoryGroup(categoryName: string, categoryType: string): string {
  const nameLower = categoryName.toLowerCase()

  // Check each group's keywords for a match
  let bestGroup: string | null = null
  let bestScore = 0

  for (const [group, keywords] of Object.entries(GROUP_KEYWORDS)) {
    for (const keyword of keywords) {
      if (nameLower.includes(keyword) || keyword.includes(nameLower)) {
        const score = Math.min(keyword.length, nameLower.length) / Math.max(keyword.length, nameLower.length)
        if (score > bestScore) {
          bestScore = score
          bestGroup = group
        }
      }
    }
  }

  if (bestGroup && bestScore >= 0.3) {
    return bestGroup
  }

  // Fallback based on category type
  if (categoryType === 'income') return 'Income'
  if (categoryType === 'transfer') return 'Transfers'

  return 'Other'
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
