/**
 * Canonical category-group reference data.
 *
 * This is the single source of truth for:
 * - Which groups exist and their display order
 * - Which default categories belong to each group
 * - BLS Consumer Expenditure Survey mapping (for benchmark comparison)
 * - Keywords for auto-inference from CSV imports
 *
 * Used by:
 * - category-groups.ts (inferCategoryGroup, classifyTransaction)
 * - categories page (grouped accordion view)
 * - budgets page (group-level spending summaries)
 * - budget-benchmarks.ts (BLS comparison at group level)
 * - category creation (smart group suggestions)
 */

export interface CategoryGroupDef {
  /** Display name (e.g. "Housing") */
  name: string
  /** Short description for UI tooltips */
  description: string
  /** Category type: expense, income, or transfer */
  type: 'expense' | 'income' | 'transfer'
  /** Display order (lower = first) */
  order: number
  /** BLS Consumer Expenditure major category (for benchmark rollup) */
  blsMajorCategory: string | null
  /** Default categories that belong to this group */
  defaultCategories: string[]
  /** Keywords for auto-inference from CSV import category names */
  keywords: string[]
}

/**
 * Canonical category groups, ordered for display.
 *
 * BLS mapping follows the Consumer Expenditure Survey major categories:
 * - Housing → "Housing"
 * - Food → "Food" (combines "Food at home" + "Food away from home")
 * - Transportation → "Transportation"
 * - Healthcare → "Healthcare"
 * - Entertainment → "Entertainment"
 * - Apparel → "Apparel and services"
 * - Education → "Education"
 * - Personal insurance/pensions → "Personal insurance and pensions"
 * - Miscellaneous → "Miscellaneous"
 */
export const CATEGORY_GROUPS: CategoryGroupDef[] = [
  {
    name: 'Housing',
    description: 'Mortgage, rent, property tax, home maintenance',
    type: 'expense',
    order: 1,
    blsMajorCategory: 'Housing',
    defaultCategories: [
      'Mortgage & Rent',
      'Home Improvement',
      'Home Services',
      'Property Tax',
      'HOA Dues',
      'Furniture & Housewares',
    ],
    keywords: [
      'mortgage', 'rent', 'hoa', 'property tax', 'home', 'housing',
      'improvement', 'repair', 'furniture', 'housewares', 'appliance',
    ],
  },
  {
    name: 'Utilities',
    description: 'Electric, water, internet, phone',
    type: 'expense',
    order: 2,
    blsMajorCategory: 'Housing', // BLS includes utilities under Housing
    defaultCategories: [
      'Electric',
      'Gas & Electric',
      'Water & Sewer',
      'Internet & Cable',
      'Phone',
      'Trash & Recycling',
    ],
    keywords: [
      'electric', 'gas & electric', 'water', 'garbage', 'internet',
      'cable', 'phone', 'cell', 'mobile', 'utility', 'sewer', 'trash',
    ],
  },
  {
    name: 'Food',
    description: 'Groceries, restaurants, coffee, delivery',
    type: 'expense',
    order: 3,
    blsMajorCategory: 'Food',
    defaultCategories: [
      'Groceries',
      'Restaurants & Bars',
      'Coffee & Tea',
      'Fast Food & Delivery',
      'Alcohol & Bars',
    ],
    keywords: [
      'groceries', 'grocery', 'restaurant', 'dining', 'food', 'coffee',
      'bars', 'bakery', 'takeout', 'delivery', 'fast food',
    ],
  },
  {
    name: 'Transport',
    description: 'Gas, auto payment, parking, transit, rideshare',
    type: 'expense',
    order: 4,
    blsMajorCategory: 'Transportation',
    defaultCategories: [
      'Gas & Fuel',
      'Auto Payment',
      'Auto Insurance',
      'Auto Maintenance',
      'Parking & Tolls',
      'Public Transit',
      'Rideshare & Taxi',
    ],
    keywords: [
      'gas', 'fuel', 'auto', 'car', 'parking', 'toll',
      'uber', 'lyft', 'taxi', 'transit', 'ride share', 'public transit',
    ],
  },
  {
    name: 'Insurance',
    description: 'Health, home, auto, life, and other insurance',
    type: 'expense',
    order: 5,
    blsMajorCategory: 'Personal insurance and pensions',
    defaultCategories: [
      'Health Insurance',
      'Home Insurance',
      'Life Insurance',
      'Renters Insurance',
    ],
    keywords: [
      'insurance', 'premium', 'usaa', 'geico', 'state farm',
    ],
  },
  {
    name: 'Healthcare',
    description: 'Medical, dental, pharmacy, fitness',
    type: 'expense',
    order: 6,
    blsMajorCategory: 'Healthcare',
    defaultCategories: [
      'Doctor & Medical',
      'Dentist',
      'Pharmacy',
      'Vision & Eye Care',
      'Gym & Fitness',
      'Mental Health',
    ],
    keywords: [
      'medical', 'doctor', 'dentist', 'pharmacy', 'hospital',
      'therapy', 'fitness', 'gym', 'health', 'wellness',
    ],
  },
  {
    name: 'Personal',
    description: 'Clothing, shopping, education, gifts, charity',
    type: 'expense',
    order: 7,
    blsMajorCategory: 'Apparel and services',
    defaultCategories: [
      'Clothing & Apparel',
      'Personal Care',
      'Education',
      'Gifts & Donations',
      'Electronics',
      'Books & Subscriptions',
    ],
    keywords: [
      'clothing', 'personal', 'shopping', 'electronics', 'education',
      'gifts', 'charity', 'donation', 'beauty', 'haircut', 'apparel',
    ],
  },
  {
    name: 'Entertainment',
    description: 'Travel, recreation, pets, streaming, hobbies',
    type: 'expense',
    order: 8,
    blsMajorCategory: 'Entertainment',
    defaultCategories: [
      'Entertainment',
      'Travel & Vacation',
      'Streaming & Media',
      'Hobbies',
      'Pets & Vet',
    ],
    keywords: [
      'entertainment', 'recreation', 'travel', 'vacation', 'hotel',
      'flight', 'pet', 'vet', 'streaming', 'movie', 'concert', 'hobby',
    ],
  },
  {
    name: 'Financial',
    description: 'Bank fees, loan payments, interest charges',
    type: 'expense',
    order: 9,
    blsMajorCategory: null, // No direct BLS mapping
    defaultCategories: [
      'Bank Fees',
      'Interest Charges',
      'Late Fees',
      'ATM Fees',
    ],
    keywords: [
      'fee', 'financial', 'legal', 'loan', 'student loan',
      'bank fee', 'interest charge', 'atm',
    ],
  },
  {
    name: 'Income',
    description: 'Salary, freelance, investments, dividends',
    type: 'income',
    order: 10,
    blsMajorCategory: null,
    defaultCategories: [
      'Salary & Wages',
      'Freelance & Contract',
      'Investment Income',
      'Rental Income',
      'Refunds & Reimbursements',
      'Other Income',
    ],
    keywords: [
      'income', 'salary', 'paycheck', 'dividend', 'interest earned',
      'bonus', 'refund', 'reimbursement', 'freelance', 'contract',
      'wages', 'investment income', 'rental income', 'interest',
      'pension', 'social security', 'annuity', 'royalty', 'commission',
      'capital gain', 'capital gains', 'dividends', 'distribution',
    ],
  },
  {
    name: 'Transfers',
    description: 'Internal transfers, credit card payments',
    type: 'transfer',
    order: 11,
    blsMajorCategory: null,
    defaultCategories: [
      'Transfer',
      'Credit Card Payment',
    ],
    keywords: [
      'transfer', 'credit card payment', 'internal transfer',
      'zelle', 'venmo', 'paypal',
    ],
  },
  {
    name: 'Other',
    description: 'Miscellaneous and uncategorized spending',
    type: 'expense',
    order: 12,
    blsMajorCategory: 'Miscellaneous',
    defaultCategories: [
      'Miscellaneous',
      'Cash & ATM',
      'Taxes',
      'Business Expense',
    ],
    keywords: [
      'miscellaneous', 'uncategorized', 'cash', 'postage', 'shipping',
      'tax', 'office', 'wedding', 'business',
    ],
  },
]

/** Group name → GroupDef lookup */
export const CATEGORY_GROUP_MAP = new Map(
  CATEGORY_GROUPS.map(g => [g.name, g])
)

/** Group name → display order */
export const GROUP_ORDER = new Map(
  CATEGORY_GROUPS.map(g => [g.name, g.order])
)

/** All group names in display order */
export const GROUP_NAMES = CATEGORY_GROUPS.map(g => g.name)

/**
 * Get the BLS major category for a given group name.
 * Returns null if the group has no BLS mapping (Income, Transfers, Financial).
 */
export function getBlsMajorCategory(groupName: string): string | null {
  return CATEGORY_GROUP_MAP.get(groupName)?.blsMajorCategory ?? null
}

/**
 * Suggest the best group for a category name based on keyword matching.
 * Returns the group name or 'Other' if no match found.
 */
export function suggestGroup(categoryName: string, categoryType?: string): string {
  const nameLower = categoryName.toLowerCase()

  let bestGroup: string | null = null
  let bestScore = 0

  for (const group of CATEGORY_GROUPS) {
    for (const keyword of group.keywords) {
      if (nameLower.includes(keyword) || keyword.includes(nameLower)) {
        const score = Math.min(keyword.length, nameLower.length) / Math.max(keyword.length, nameLower.length)
        if (score > bestScore) {
          bestScore = score
          bestGroup = group.name
        }
      }
    }
  }

  if (bestGroup && bestScore >= 0.3) return bestGroup

  // Fallback based on type
  if (categoryType === 'income') return 'Income'
  if (categoryType === 'transfer') return 'Transfers'
  return 'Other'
}
