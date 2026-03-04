import { PrismaClient } from '@prisma/client'

const DEFAULT_CATEGORIES = [
  { type: 'income', group: 'Income', name: 'Paychecks' },
  { type: 'income', group: 'Income', name: 'Side Income' },
  { type: 'income', group: 'Income', name: 'Rental Income' },
  { type: 'income', group: 'Income', name: 'Dividends & Interest' },
  { type: 'income', group: 'Income', name: 'Other Income' },
  { type: 'expense', group: 'Housing', name: 'Mortgage' },
  { type: 'expense', group: 'Housing', name: 'Rent' },
  { type: 'expense', group: 'Housing', name: 'Home Improvement' },
  { type: 'expense', group: 'Bills & Utilities', name: 'Gas & Electric' },
  { type: 'expense', group: 'Bills & Utilities', name: 'Internet & Phone' },
  { type: 'expense', group: 'Bills & Utilities', name: 'Water & Sewer' },
  { type: 'expense', group: 'Food & Dining', name: 'Groceries' },
  { type: 'expense', group: 'Food & Dining', name: 'Restaurants & Bars' },
  { type: 'expense', group: 'Food & Dining', name: 'Coffee Shops' },
  { type: 'expense', group: 'Auto & Transport', name: 'Gas & Fuel' },
  { type: 'expense', group: 'Auto & Transport', name: 'Auto Payment' },
  { type: 'expense', group: 'Auto & Transport', name: 'Auto Insurance' },
  { type: 'expense', group: 'Health & Wellness', name: 'Medical' },
  { type: 'expense', group: 'Health & Wellness', name: 'Gym & Fitness' },
  { type: 'expense', group: 'Shopping', name: 'Shopping' },
  { type: 'expense', group: 'Shopping', name: 'Clothing' },
  { type: 'expense', group: 'Personal', name: 'Personal Care' },
  { type: 'expense', group: 'Entertainment', name: 'Entertainment' },
  { type: 'expense', group: 'Entertainment', name: 'Subscriptions' },
  { type: 'expense', group: 'Travel & Lifestyle', name: 'Travel & Vacation' },
  { type: 'expense', group: 'Financial', name: 'Insurance' },
  { type: 'expense', group: 'Financial', name: 'Bank Fees' },
  { type: 'expense', group: 'Financial', name: 'Loan Payment' },
  { type: 'expense', group: 'Gifts & Donations', name: 'Gifts & Donations' },
  { type: 'expense', group: 'Other', name: 'Uncategorized' },
  { type: 'transfer', group: 'Transfers', name: 'Transfer' },
  { type: 'transfer', group: 'Transfers', name: 'Credit Card Payment' },
]

const db = new PrismaClient()

async function backfill() {
  const users = await db.user.findMany({ select: { id: true, email: true } })
  console.log(`Found ${users.length} users to process`)

  for (const user of users) {
    const existingCategories = await db.category.findMany({
      where: { userId: user.id },
      select: { name: true },
    })
    const existingNames = new Set(existingCategories.map(c => c.name.toLowerCase()))

    let added = 0
    for (const cat of DEFAULT_CATEGORIES) {
      if (!existingNames.has(cat.name.toLowerCase())) {
        await db.category.create({
          data: { userId: user.id, ...cat, isDefault: false, isActive: true },
        })
        added++
      }
    }

    if (added > 0) {
      console.log(`  ${user.email}: added ${added} missing categories`)
    } else {
      console.log(`  ${user.email}: all default categories present`)
    }
  }
}

backfill()
  .catch(console.error)
  .finally(() => db.$disconnect())
