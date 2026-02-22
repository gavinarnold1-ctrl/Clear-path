/**
 * Seed script — populates the database with demo data for local development.
 * Run with: npm run db:seed
 */
import { PrismaClient, AccountType, BudgetPeriod, BudgetTier } from '@prisma/client'

const db = new PrismaClient()

type SeedCategory = {
  type: string
  group: string
  name: string
  icon: string
  budgetTier?: 'FIXED' | 'FLEXIBLE' | 'ANNUAL' | null
}

const DEFAULT_CATEGORIES: SeedCategory[] = [
  // === INCOME ===
  { type: 'income', group: 'Income', name: 'Paychecks', icon: '💵' },
  { type: 'income', group: 'Income', name: 'Interest', icon: '💸' },
  { type: 'income', group: 'Income', name: 'Business Income', icon: '💰' },
  { type: 'income', group: 'Income', name: 'Other Income', icon: '💰' },

  // === EXPENSES ===
  // Gifts & Donations
  { type: 'expense', group: 'Gifts & Donations', name: 'Charity', icon: '🎗️', budgetTier: 'ANNUAL' },
  { type: 'expense', group: 'Gifts & Donations', name: 'Gifts', icon: '🎁', budgetTier: 'ANNUAL' },

  // Auto & Transport
  { type: 'expense', group: 'Auto & Transport', name: 'Auto Payment', icon: '🚗', budgetTier: 'FIXED' },
  { type: 'expense', group: 'Auto & Transport', name: 'Public Transit', icon: '🚃', budgetTier: 'FLEXIBLE' },
  { type: 'expense', group: 'Auto & Transport', name: 'Gas', icon: '⛽️', budgetTier: 'FLEXIBLE' },
  { type: 'expense', group: 'Auto & Transport', name: 'Auto Maintenance', icon: '🔧', budgetTier: 'ANNUAL' },
  { type: 'expense', group: 'Auto & Transport', name: 'Parking & Tolls', icon: '🏢', budgetTier: 'FLEXIBLE' },
  { type: 'expense', group: 'Auto & Transport', name: 'Taxi & Ride Shares', icon: '🚕', budgetTier: 'FLEXIBLE' },

  // Housing
  { type: 'expense', group: 'Housing', name: 'Mortgage', icon: '🏠', budgetTier: 'FIXED' },
  { type: 'expense', group: 'Housing', name: 'Rent', icon: '🏠', budgetTier: 'FIXED' },
  { type: 'expense', group: 'Housing', name: 'Home Improvement', icon: '🔨', budgetTier: 'ANNUAL' },

  // Bills & Utilities
  { type: 'expense', group: 'Bills & Utilities', name: 'Garbage', icon: '🗑️', budgetTier: 'FIXED' },
  { type: 'expense', group: 'Bills & Utilities', name: 'Water', icon: '💧', budgetTier: 'FIXED' },
  { type: 'expense', group: 'Bills & Utilities', name: 'Gas & Electric', icon: '⚡️', budgetTier: 'FIXED' },
  { type: 'expense', group: 'Bills & Utilities', name: 'Internet & Cable', icon: '🌐', budgetTier: 'FIXED' },
  { type: 'expense', group: 'Bills & Utilities', name: 'Phone', icon: '📱', budgetTier: 'FIXED' },

  // Food & Dining
  { type: 'expense', group: 'Food & Dining', name: 'Groceries', icon: '🍏', budgetTier: 'FLEXIBLE' },
  { type: 'expense', group: 'Food & Dining', name: 'Restaurants & Bars', icon: '🍽️', budgetTier: 'FLEXIBLE' },
  { type: 'expense', group: 'Food & Dining', name: 'Coffee Shops', icon: '☕️', budgetTier: 'FLEXIBLE' },

  // Travel & Lifestyle
  { type: 'expense', group: 'Travel & Lifestyle', name: 'Travel & Vacation', icon: '🏝️', budgetTier: 'ANNUAL' },
  { type: 'expense', group: 'Travel & Lifestyle', name: 'Entertainment & Recreation', icon: '🎥', budgetTier: 'FLEXIBLE' },
  { type: 'expense', group: 'Travel & Lifestyle', name: 'Personal', icon: '👑', budgetTier: 'FLEXIBLE' },
  { type: 'expense', group: 'Travel & Lifestyle', name: 'Pets', icon: '🐶', budgetTier: 'FLEXIBLE' },
  { type: 'expense', group: 'Travel & Lifestyle', name: 'Fun Money', icon: '😜', budgetTier: 'FLEXIBLE' },

  // Shopping
  { type: 'expense', group: 'Shopping', name: 'Shopping', icon: '🛍️', budgetTier: 'FLEXIBLE' },
  { type: 'expense', group: 'Shopping', name: 'Clothing', icon: '👕', budgetTier: 'FLEXIBLE' },
  { type: 'expense', group: 'Shopping', name: 'Furniture & Housewares', icon: '🪑', budgetTier: 'ANNUAL' },
  { type: 'expense', group: 'Shopping', name: 'Electronics', icon: '🖥️', budgetTier: 'ANNUAL' },

  // Children
  { type: 'expense', group: 'Children', name: 'Child Care', icon: '👶', budgetTier: 'FIXED' },
  { type: 'expense', group: 'Children', name: 'Child Activities', icon: '⚽️', budgetTier: 'FLEXIBLE' },

  // Education
  { type: 'expense', group: 'Education', name: 'Student Loans', icon: '🎓', budgetTier: 'FIXED' },
  { type: 'expense', group: 'Education', name: 'Education', icon: '🏫', budgetTier: 'ANNUAL' },

  // Health & Wellness
  { type: 'expense', group: 'Health & Wellness', name: 'Medical', icon: '💊', budgetTier: 'ANNUAL' },
  { type: 'expense', group: 'Health & Wellness', name: 'Dentist', icon: '🦷', budgetTier: 'ANNUAL' },
  { type: 'expense', group: 'Health & Wellness', name: 'Fitness', icon: '💪', budgetTier: 'FIXED' },

  // Financial
  { type: 'expense', group: 'Financial', name: 'Loan Repayment', icon: '💰', budgetTier: 'FIXED' },
  { type: 'expense', group: 'Financial', name: 'Financial & Legal Services', icon: '🗄️', budgetTier: 'ANNUAL' },
  { type: 'expense', group: 'Financial', name: 'Financial Fees', icon: '🏦', budgetTier: 'FLEXIBLE' },
  { type: 'expense', group: 'Financial', name: 'Cash & ATM', icon: '🏧', budgetTier: 'FLEXIBLE' },
  { type: 'expense', group: 'Financial', name: 'Insurance', icon: '☂️', budgetTier: 'FIXED' },
  { type: 'expense', group: 'Financial', name: 'Taxes', icon: '🏛️', budgetTier: 'ANNUAL' },

  // Other
  { type: 'expense', group: 'Other', name: 'Uncategorized', icon: '❓' },

  // === TRANSFERS ===
  { type: 'transfer', group: 'Transfers', name: 'Transfer', icon: '🔄' },
  { type: 'transfer', group: 'Transfers', name: 'Credit Card Payment', icon: '💳' },
]

async function seedCategories(userId: string) {
  for (const cat of DEFAULT_CATEGORIES) {
    await db.category.upsert({
      where: {
        userId_type_group_name: { userId, type: cat.type, group: cat.group, name: cat.name },
      },
      update: { budgetTier: cat.budgetTier ?? null },
      create: {
        userId,
        type: cat.type,
        group: cat.group,
        name: cat.name,
        icon: cat.icon,
        budgetTier: cat.budgetTier ?? null,
      },
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
  const seedTransactions = [
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
  ]
  await db.transaction.createMany({ data: seedTransactions })

  // Roll transaction amounts into the checking account balance
  const txTotal = seedTransactions
    .filter((t) => t.accountId === checking.id)
    .reduce((sum, t) => sum + t.amount, 0)
  await db.account.update({
    where: { id: checking.id },
    data: { balance: { increment: txTotal } },
  })

  // Lookup more categories for budgets
  const mortgage = await db.category.findFirst({ where: { userId: user.id, name: 'Mortgage' } })
  const internet = await db.category.findFirst({ where: { userId: user.id, name: 'Internet & Cable' } })
  const phone = await db.category.findFirst({ where: { userId: user.id, name: 'Phone' } })
  const dining = await db.category.findFirst({ where: { userId: user.id, name: 'Restaurants & Bars' } })
  const travel = await db.category.findFirst({ where: { userId: user.id, name: 'Travel & Vacation' } })

  // ─── FIXED budgets ─────────────────────────────────────────────────
  if (mortgage) {
    await db.budget.create({
      data: {
        userId: user.id,
        categoryId: mortgage.id,
        name: 'Mortgage',
        amount: 1850,
        spent: 1850,
        period: BudgetPeriod.MONTHLY,
        tier: BudgetTier.FIXED,
        startDate: new Date('2026-02-01'),
        isAutoPay: true,
        dueDay: 1,
        varianceLimit: 0,
      },
    })
  }

  if (internet) {
    await db.budget.create({
      data: {
        userId: user.id,
        categoryId: internet.id,
        name: 'Internet',
        amount: 79.99,
        spent: 0,
        period: BudgetPeriod.MONTHLY,
        tier: BudgetTier.FIXED,
        startDate: new Date('2026-02-01'),
        isAutoPay: true,
        dueDay: 15,
        varianceLimit: 5,
      },
    })
  }

  if (phone) {
    await db.budget.create({
      data: {
        userId: user.id,
        categoryId: phone.id,
        name: 'Phone plan',
        amount: 55,
        spent: 55,
        period: BudgetPeriod.MONTHLY,
        tier: BudgetTier.FIXED,
        startDate: new Date('2026-02-01'),
        isAutoPay: true,
        dueDay: 20,
      },
    })
  }

  // ─── FLEXIBLE budgets ──────────────────────────────────────────────
  if (groceries) {
    await db.budget.create({
      data: {
        userId: user.id,
        categoryId: groceries.id,
        name: 'Groceries',
        amount: 500,
        spent: 120.5,
        period: BudgetPeriod.MONTHLY,
        tier: BudgetTier.FLEXIBLE,
        startDate: new Date('2026-02-01'),
      },
    })
  }

  if (dining) {
    await db.budget.create({
      data: {
        userId: user.id,
        categoryId: dining.id,
        name: 'Dining out',
        amount: 200,
        spent: 85,
        period: BudgetPeriod.MONTHLY,
        tier: BudgetTier.FLEXIBLE,
        startDate: new Date('2026-02-01'),
      },
    })
  }

  // ─── ANNUAL budgets ────────────────────────────────────────────────
  if (travel) {
    const vacationBudget = await db.budget.create({
      data: {
        userId: user.id,
        categoryId: travel.id,
        name: 'Summer vacation',
        amount: 300,
        spent: 0,
        period: BudgetPeriod.MONTHLY,
        tier: BudgetTier.ANNUAL,
        startDate: new Date('2026-01-01'),
      },
    })

    await db.annualExpense.create({
      data: {
        userId: user.id,
        budgetId: vacationBudget.id,
        name: 'Summer vacation',
        annualAmount: 3600,
        dueMonth: 7,
        dueYear: 2026,
        monthlySetAside: 300,
        funded: 600,
        isRecurring: false,
        status: 'planned',
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
