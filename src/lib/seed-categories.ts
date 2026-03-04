import { db } from '@/lib/db'

export const DEFAULT_CATEGORIES = [
  // Income (5)
  { type: 'income', group: 'Income', name: 'Paychecks' },
  { type: 'income', group: 'Income', name: 'Side Income' },
  { type: 'income', group: 'Income', name: 'Rental Income' },
  { type: 'income', group: 'Income', name: 'Dividends & Interest' },
  { type: 'income', group: 'Income', name: 'Other Income' },
  // Housing (3)
  { type: 'expense', group: 'Housing', name: 'Mortgage' },
  { type: 'expense', group: 'Housing', name: 'Rent' },
  { type: 'expense', group: 'Housing', name: 'Home Improvement' },
  // Bills & Utilities (3)
  { type: 'expense', group: 'Bills & Utilities', name: 'Gas & Electric' },
  { type: 'expense', group: 'Bills & Utilities', name: 'Internet & Phone' },
  { type: 'expense', group: 'Bills & Utilities', name: 'Water & Sewer' },
  // Food (3)
  { type: 'expense', group: 'Food & Dining', name: 'Groceries' },
  { type: 'expense', group: 'Food & Dining', name: 'Restaurants & Bars' },
  { type: 'expense', group: 'Food & Dining', name: 'Coffee Shops' },
  // Transport (3)
  { type: 'expense', group: 'Auto & Transport', name: 'Gas & Fuel' },
  { type: 'expense', group: 'Auto & Transport', name: 'Auto Payment' },
  { type: 'expense', group: 'Auto & Transport', name: 'Auto Insurance' },
  // Health (2)
  { type: 'expense', group: 'Health & Wellness', name: 'Medical' },
  { type: 'expense', group: 'Health & Wellness', name: 'Gym & Fitness' },
  // Personal (3)
  { type: 'expense', group: 'Shopping', name: 'Shopping' },
  { type: 'expense', group: 'Shopping', name: 'Clothing' },
  { type: 'expense', group: 'Personal', name: 'Personal Care' },
  // Entertainment & Travel (3)
  { type: 'expense', group: 'Entertainment', name: 'Entertainment' },
  { type: 'expense', group: 'Entertainment', name: 'Subscriptions' },
  { type: 'expense', group: 'Travel & Lifestyle', name: 'Travel & Vacation' },
  // Financial (3)
  { type: 'expense', group: 'Financial', name: 'Insurance' },
  { type: 'expense', group: 'Financial', name: 'Bank Fees' },
  { type: 'expense', group: 'Financial', name: 'Loan Payment' },
  // Other (2)
  { type: 'expense', group: 'Gifts & Donations', name: 'Gifts & Donations' },
  { type: 'expense', group: 'Other', name: 'Uncategorized' },
  // Transfers (2)
  { type: 'transfer', group: 'Transfers', name: 'Transfer' },
  { type: 'transfer', group: 'Transfers', name: 'Credit Card Payment' },
] as const

export async function seedUserCategories(userId: string) {
  const existing = await db.category.count({ where: { userId } })
  if (existing > 0) return // Don't re-seed

  for (const cat of DEFAULT_CATEGORIES) {
    await db.category.create({
      data: { userId, ...cat, isDefault: false, isActive: true },
    })
  }
}
