/**
 * Seed script — populates the database with demo data for local development.
 * Run with: npm run db:seed
 */
import { PrismaClient, AccountType, BudgetPeriod } from '@prisma/client'

const db = new PrismaClient()

const DEFAULT_CATEGORIES = [
  // === INCOME ===
  { type: 'income', group: 'Income', name: 'Paychecks', icon: '💵' },
  { type: 'income', group: 'Income', name: 'Interest', icon: '💸' },
  { type: 'income', group: 'Income', name: 'Business Income', icon: '💰' },
  { type: 'income', group: 'Income', name: 'Other Income', icon: '💰' },

  // === EXPENSES ===
  // Gifts & Donations
  { type: 'expense', group: 'Gifts & Donations', name: 'Charity', icon: '🎗️' },
  { type: 'expense', group: 'Gifts & Donations', name: 'Gifts', icon: '🎁' },

  // Auto & Transport
  { type: 'expense', group: 'Auto & Transport', name: 'Auto Payment', icon: '🚗' },
  { type: 'expense', group: 'Auto & Transport', name: 'Public Transit', icon: '🚃' },
  { type: 'expense', group: 'Auto & Transport', name: 'Gas', icon: '⛽️' },
  { type: 'expense', group: 'Auto & Transport', name: 'Auto Maintenance', icon: '🔧' },
  { type: 'expense', group: 'Auto & Transport', name: 'Parking & Tolls', icon: '🏢' },
  { type: 'expense', group: 'Auto & Transport', name: 'Taxi & Ride Shares', icon: '🚕' },

  // Housing
  { type: 'expense', group: 'Housing', name: 'Mortgage', icon: '🏠' },
  { type: 'expense', group: 'Housing', name: 'Rent', icon: '🏠' },
  { type: 'expense', group: 'Housing', name: 'Home Improvement', icon: '🔨' },

  // Bills & Utilities
  { type: 'expense', group: 'Bills & Utilities', name: 'Garbage', icon: '🗑️' },
  { type: 'expense', group: 'Bills & Utilities', name: 'Water', icon: '💧' },
  { type: 'expense', group: 'Bills & Utilities', name: 'Gas & Electric', icon: '⚡️' },
  { type: 'expense', group: 'Bills & Utilities', name: 'Internet & Cable', icon: '🌐' },
  { type: 'expense', group: 'Bills & Utilities', name: 'Phone', icon: '📱' },

  // Food & Dining
  { type: 'expense', group: 'Food & Dining', name: 'Groceries', icon: '🍏' },
  { type: 'expense', group: 'Food & Dining', name: 'Restaurants & Bars', icon: '🍽️' },
  { type: 'expense', group: 'Food & Dining', name: 'Coffee Shops', icon: '☕️' },

  // Travel & Lifestyle
  { type: 'expense', group: 'Travel & Lifestyle', name: 'Travel & Vacation', icon: '🏝️' },
  { type: 'expense', group: 'Travel & Lifestyle', name: 'Entertainment & Recreation', icon: '🎥' },
  { type: 'expense', group: 'Travel & Lifestyle', name: 'Personal', icon: '👑' },
  { type: 'expense', group: 'Travel & Lifestyle', name: 'Pets', icon: '🐶' },
  { type: 'expense', group: 'Travel & Lifestyle', name: 'Fun Money', icon: '😜' },

  // Shopping
  { type: 'expense', group: 'Shopping', name: 'Shopping', icon: '🛍️' },
  { type: 'expense', group: 'Shopping', name: 'Clothing', icon: '👕' },
  { type: 'expense', group: 'Shopping', name: 'Furniture & Housewares', icon: '🪑' },
  { type: 'expense', group: 'Shopping', name: 'Electronics', icon: '🖥️' },

  // Children
  { type: 'expense', group: 'Children', name: 'Child Care', icon: '👶' },
  { type: 'expense', group: 'Children', name: 'Child Activities', icon: '⚽️' },

  // Education
  { type: 'expense', group: 'Education', name: 'Student Loans', icon: '🎓' },
  { type: 'expense', group: 'Education', name: 'Education', icon: '🏫' },

  // Health & Wellness
  { type: 'expense', group: 'Health & Wellness', name: 'Medical', icon: '💊' },
  { type: 'expense', group: 'Health & Wellness', name: 'Dentist', icon: '🦷' },
  { type: 'expense', group: 'Health & Wellness', name: 'Fitness', icon: '💪' },

  // Financial
  { type: 'expense', group: 'Financial', name: 'Loan Repayment', icon: '💰' },
  { type: 'expense', group: 'Financial', name: 'Financial & Legal Services', icon: '🗄️' },
  { type: 'expense', group: 'Financial', name: 'Financial Fees', icon: '🏦' },
  { type: 'expense', group: 'Financial', name: 'Cash & ATM', icon: '🏧' },
  { type: 'expense', group: 'Financial', name: 'Insurance', icon: '☂️' },
  { type: 'expense', group: 'Financial', name: 'Taxes', icon: '🏛️' },

  // Other
  { type: 'expense', group: 'Other', name: 'Uncategorized', icon: '❓' },

  // === TRANSFERS ===
  { type: 'transfer', group: 'Transfers', name: 'Transfer', icon: '🔄' },
  { type: 'transfer', group: 'Transfers', name: 'Credit Card Payment', icon: '💳' },
] as const

async function seedCategories(userId: string) {
  for (const cat of DEFAULT_CATEGORIES) {
    await db.category.upsert({
      where: {
        userId_type_group_name: { userId, type: cat.type, group: cat.group, name: cat.name },
      },
      update: {},
      create: { userId, type: cat.type, group: cat.group, name: cat.name, icon: cat.icon },
    })
  }
}

async function main() {
  // Create a demo user (password would be hashed in production)
  const user = await db.user.upsert({
    where: { email: 'demo@clear-path.app' },
    update: {},
    create: {
      email: 'demo@clear-path.app',
      name: 'Demo User',
      password: 'hashed-password-placeholder',
    },
  })

  // Seed default categories
  await seedCategories(user.id)

  // Accounts
  const checking = await db.account.create({
    data: { userId: user.id, name: 'Main Checking', type: AccountType.CHECKING, balance: 3500 },
  })
  await db.account.create({
    data: { userId: user.id, name: 'Savings', type: AccountType.SAVINGS, balance: 12000 },
  })

  // Lookup categories for demo transactions
  const paychecks = await db.category.findFirst({
    where: { userId: user.id, name: 'Paychecks' },
  })
  const groceries = await db.category.findFirst({
    where: { userId: user.id, name: 'Groceries' },
  })

  // Transactions (signed amounts: positive = income, negative = expense)
  await db.transaction.createMany({
    data: [
      {
        userId: user.id,
        accountId: checking.id,
        categoryId: paychecks?.id ?? null,
        amount: 5000,
        merchant: 'Employer Inc.',
        date: new Date('2026-02-01'),
      },
      {
        userId: user.id,
        accountId: checking.id,
        categoryId: groceries?.id ?? null,
        amount: -120.5,
        merchant: 'Whole Foods',
        date: new Date('2026-02-10'),
      },
    ],
  })

  // Budget
  if (groceries) {
    await db.budget.create({
      data: {
        userId: user.id,
        categoryId: groceries.id,
        name: 'Grocery Budget',
        amount: 500,
        spent: 120.5,
        period: BudgetPeriod.MONTHLY,
        startDate: new Date('2026-02-01'),
      },
    })
  }

  console.log('Seed complete. Demo user: demo@clear-path.app')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
