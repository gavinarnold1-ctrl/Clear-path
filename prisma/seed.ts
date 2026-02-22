/**
 * Seed script — populates the database with demo data for local development.
 * Run with: npm run db:seed
 */
import { PrismaClient, TransactionType, AccountType } from '@prisma/client'

const db = new PrismaClient()

// ─── Monarch default categories ────────────────────────────────────────────

interface DefaultCategory {
  name: string
  group: string
  type: TransactionType
  budgetTier: string | null
  color: string
  icon: string | null
}

const DEFAULT_CATEGORIES: DefaultCategory[] = [
  // ── Income ────────────────────────────────────────────────────────────────
  { name: 'Salary & Wages', group: 'Income', type: TransactionType.INCOME, budgetTier: null, color: '#6366f1', icon: '💼' },
  { name: 'Freelance & Contract', group: 'Income', type: TransactionType.INCOME, budgetTier: null, color: '#8b5cf6', icon: '💻' },
  { name: 'Interest & Dividends', group: 'Income', type: TransactionType.INCOME, budgetTier: null, color: '#14b8a6', icon: '📈' },
  { name: 'Rental Income', group: 'Income', type: TransactionType.INCOME, budgetTier: null, color: '#22c55e', icon: '🏠' },
  { name: 'Refunds & Reimbursements', group: 'Income', type: TransactionType.INCOME, budgetTier: null, color: '#3b82f6', icon: '💵' },
  { name: 'Other Income', group: 'Income', type: TransactionType.INCOME, budgetTier: null, color: '#64748b', icon: '💰' },

  // ── Housing (Fixed) ──────────────────────────────────────────────────────
  { name: 'Rent', group: 'Housing', type: TransactionType.EXPENSE, budgetTier: 'fixed', color: '#ef4444', icon: '🏠' },
  { name: 'Mortgage', group: 'Housing', type: TransactionType.EXPENSE, budgetTier: 'fixed', color: '#dc2626', icon: '🏡' },
  { name: 'Property Tax', group: 'Housing', type: TransactionType.EXPENSE, budgetTier: 'annual', color: '#b91c1c', icon: '🏛️' },
  { name: 'HOA Fees', group: 'Housing', type: TransactionType.EXPENSE, budgetTier: 'fixed', color: '#f87171', icon: '🏢' },
  { name: 'Home Maintenance', group: 'Housing', type: TransactionType.EXPENSE, budgetTier: 'flexible', color: '#fca5a5', icon: '🔧' },

  // ── Utilities (Fixed) ────────────────────────────────────────────────────
  { name: 'Electric', group: 'Utilities', type: TransactionType.EXPENSE, budgetTier: 'fixed', color: '#f59e0b', icon: '⚡' },
  { name: 'Gas', group: 'Utilities', type: TransactionType.EXPENSE, budgetTier: 'fixed', color: '#d97706', icon: '🔥' },
  { name: 'Water & Sewer', group: 'Utilities', type: TransactionType.EXPENSE, budgetTier: 'fixed', color: '#3b82f6', icon: '💧' },
  { name: 'Internet', group: 'Utilities', type: TransactionType.EXPENSE, budgetTier: 'fixed', color: '#6366f1', icon: '🌐' },
  { name: 'Phone', group: 'Utilities', type: TransactionType.EXPENSE, budgetTier: 'fixed', color: '#8b5cf6', icon: '📱' },
  { name: 'Trash & Recycling', group: 'Utilities', type: TransactionType.EXPENSE, budgetTier: 'fixed', color: '#64748b', icon: '🗑️' },

  // ── Food & Dining (Flexible) ─────────────────────────────────────────────
  { name: 'Groceries', group: 'Food & Dining', type: TransactionType.EXPENSE, budgetTier: 'flexible', color: '#22c55e', icon: '🛒' },
  { name: 'Restaurants', group: 'Food & Dining', type: TransactionType.EXPENSE, budgetTier: 'flexible', color: '#16a34a', icon: '🍽️' },
  { name: 'Coffee Shops', group: 'Food & Dining', type: TransactionType.EXPENSE, budgetTier: 'flexible', color: '#15803d', icon: '☕' },
  { name: 'Fast Food', group: 'Food & Dining', type: TransactionType.EXPENSE, budgetTier: 'flexible', color: '#4ade80', icon: '🍔' },
  { name: 'Alcohol & Bars', group: 'Food & Dining', type: TransactionType.EXPENSE, budgetTier: 'flexible', color: '#86efac', icon: '🍺' },

  // ── Transportation (Mixed) ───────────────────────────────────────────────
  { name: 'Car Payment', group: 'Transportation', type: TransactionType.EXPENSE, budgetTier: 'fixed', color: '#0ea5e9', icon: '🚗' },
  { name: 'Car Insurance', group: 'Transportation', type: TransactionType.EXPENSE, budgetTier: 'fixed', color: '#0284c7', icon: '🛡️' },
  { name: 'Gas & Fuel', group: 'Transportation', type: TransactionType.EXPENSE, budgetTier: 'flexible', color: '#0369a1', icon: '⛽' },
  { name: 'Parking', group: 'Transportation', type: TransactionType.EXPENSE, budgetTier: 'flexible', color: '#38bdf8', icon: '🅿️' },
  { name: 'Public Transit', group: 'Transportation', type: TransactionType.EXPENSE, budgetTier: 'flexible', color: '#7dd3fc', icon: '🚇' },
  { name: 'Rideshare & Taxi', group: 'Transportation', type: TransactionType.EXPENSE, budgetTier: 'flexible', color: '#bae6fd', icon: '🚕' },
  { name: 'Car Maintenance', group: 'Transportation', type: TransactionType.EXPENSE, budgetTier: 'flexible', color: '#075985', icon: '🔧' },

  // ── Insurance (Fixed) ────────────────────────────────────────────────────
  { name: 'Health Insurance', group: 'Insurance', type: TransactionType.EXPENSE, budgetTier: 'fixed', color: '#ec4899', icon: '🏥' },
  { name: 'Life Insurance', group: 'Insurance', type: TransactionType.EXPENSE, budgetTier: 'fixed', color: '#db2777', icon: '❤️' },
  { name: 'Home Insurance', group: 'Insurance', type: TransactionType.EXPENSE, budgetTier: 'annual', color: '#be185d', icon: '🏠' },
  { name: 'Renters Insurance', group: 'Insurance', type: TransactionType.EXPENSE, budgetTier: 'annual', color: '#f472b6', icon: '📋' },

  // ── Healthcare (Flexible) ────────────────────────────────────────────────
  { name: 'Doctor & Dentist', group: 'Healthcare', type: TransactionType.EXPENSE, budgetTier: 'flexible', color: '#14b8a6', icon: '🩺' },
  { name: 'Pharmacy', group: 'Healthcare', type: TransactionType.EXPENSE, budgetTier: 'flexible', color: '#0d9488', icon: '💊' },
  { name: 'Vision & Optical', group: 'Healthcare', type: TransactionType.EXPENSE, budgetTier: 'flexible', color: '#0f766e', icon: '👓' },
  { name: 'Mental Health', group: 'Healthcare', type: TransactionType.EXPENSE, budgetTier: 'flexible', color: '#5eead4', icon: '🧠' },

  // ── Subscriptions & Memberships (Fixed) ──────────────────────────────────
  { name: 'Streaming Services', group: 'Subscriptions', type: TransactionType.EXPENSE, budgetTier: 'fixed', color: '#a855f7', icon: '📺' },
  { name: 'Music Services', group: 'Subscriptions', type: TransactionType.EXPENSE, budgetTier: 'fixed', color: '#9333ea', icon: '🎵' },
  { name: 'Software & Apps', group: 'Subscriptions', type: TransactionType.EXPENSE, budgetTier: 'fixed', color: '#7c3aed', icon: '📱' },
  { name: 'Gym & Fitness', group: 'Subscriptions', type: TransactionType.EXPENSE, budgetTier: 'fixed', color: '#6d28d9', icon: '🏋️' },
  { name: 'Newspapers & Magazines', group: 'Subscriptions', type: TransactionType.EXPENSE, budgetTier: 'fixed', color: '#c084fc', icon: '📰' },

  // ── Shopping (Flexible) ──────────────────────────────────────────────────
  { name: 'Clothing', group: 'Shopping', type: TransactionType.EXPENSE, budgetTier: 'flexible', color: '#f97316', icon: '👕' },
  { name: 'Electronics', group: 'Shopping', type: TransactionType.EXPENSE, budgetTier: 'flexible', color: '#ea580c', icon: '📱' },
  { name: 'Home Goods', group: 'Shopping', type: TransactionType.EXPENSE, budgetTier: 'flexible', color: '#c2410c', icon: '🛋️' },
  { name: 'Gifts', group: 'Shopping', type: TransactionType.EXPENSE, budgetTier: 'flexible', color: '#fb923c', icon: '🎁' },
  { name: 'Online Shopping', group: 'Shopping', type: TransactionType.EXPENSE, budgetTier: 'flexible', color: '#fdba74', icon: '📦' },

  // ── Personal Care (Flexible) ─────────────────────────────────────────────
  { name: 'Hair & Beauty', group: 'Personal Care', type: TransactionType.EXPENSE, budgetTier: 'flexible', color: '#e879f9', icon: '💇' },
  { name: 'Spa & Wellness', group: 'Personal Care', type: TransactionType.EXPENSE, budgetTier: 'flexible', color: '#d946ef', icon: '🧖' },

  // ── Entertainment (Flexible) ─────────────────────────────────────────────
  { name: 'Movies & Events', group: 'Entertainment', type: TransactionType.EXPENSE, budgetTier: 'flexible', color: '#f43f5e', icon: '🎬' },
  { name: 'Hobbies', group: 'Entertainment', type: TransactionType.EXPENSE, budgetTier: 'flexible', color: '#e11d48', icon: '🎨' },
  { name: 'Games', group: 'Entertainment', type: TransactionType.EXPENSE, budgetTier: 'flexible', color: '#be123c', icon: '🎮' },
  { name: 'Books', group: 'Entertainment', type: TransactionType.EXPENSE, budgetTier: 'flexible', color: '#fb7185', icon: '📚' },

  // ── Education (Mixed) ────────────────────────────────────────────────────
  { name: 'Tuition', group: 'Education', type: TransactionType.EXPENSE, budgetTier: 'annual', color: '#6366f1', icon: '🎓' },
  { name: 'Student Loans', group: 'Education', type: TransactionType.EXPENSE, budgetTier: 'fixed', color: '#4f46e5', icon: '📝' },
  { name: 'Books & Supplies', group: 'Education', type: TransactionType.EXPENSE, budgetTier: 'flexible', color: '#4338ca', icon: '📖' },

  // ── Children & Family (Flexible) ─────────────────────────────────────────
  { name: 'Childcare', group: 'Children & Family', type: TransactionType.EXPENSE, budgetTier: 'fixed', color: '#06b6d4', icon: '👶' },
  { name: 'Kids Activities', group: 'Children & Family', type: TransactionType.EXPENSE, budgetTier: 'flexible', color: '#0891b2', icon: '⚽' },
  { name: 'Baby Supplies', group: 'Children & Family', type: TransactionType.EXPENSE, budgetTier: 'flexible', color: '#67e8f9', icon: '🍼' },

  // ── Pets (Flexible) ──────────────────────────────────────────────────────
  { name: 'Pet Food & Supplies', group: 'Pets', type: TransactionType.EXPENSE, budgetTier: 'flexible', color: '#a16207', icon: '🐾' },
  { name: 'Vet & Pet Health', group: 'Pets', type: TransactionType.EXPENSE, budgetTier: 'flexible', color: '#ca8a04', icon: '🏥' },

  // ── Travel (Flexible) ────────────────────────────────────────────────────
  { name: 'Flights', group: 'Travel', type: TransactionType.EXPENSE, budgetTier: 'flexible', color: '#0ea5e9', icon: '✈️' },
  { name: 'Hotels & Lodging', group: 'Travel', type: TransactionType.EXPENSE, budgetTier: 'flexible', color: '#0284c7', icon: '🏨' },
  { name: 'Vacation', group: 'Travel', type: TransactionType.EXPENSE, budgetTier: 'flexible', color: '#38bdf8', icon: '🌴' },

  // ── Debt Payments (Fixed) ────────────────────────────────────────────────
  { name: 'Credit Card Payment', group: 'Debt Payments', type: TransactionType.EXPENSE, budgetTier: 'fixed', color: '#ef4444', icon: '💳' },
  { name: 'Personal Loan', group: 'Debt Payments', type: TransactionType.EXPENSE, budgetTier: 'fixed', color: '#dc2626', icon: '🏦' },

  // ── Savings & Investments (Fixed) ────────────────────────────────────────
  { name: 'Emergency Fund', group: 'Savings & Investments', type: TransactionType.EXPENSE, budgetTier: 'fixed', color: '#22c55e', icon: '🛟' },
  { name: 'Retirement (401k/IRA)', group: 'Savings & Investments', type: TransactionType.EXPENSE, budgetTier: 'fixed', color: '#16a34a', icon: '🏦' },
  { name: 'Investments', group: 'Savings & Investments', type: TransactionType.EXPENSE, budgetTier: 'fixed', color: '#15803d', icon: '📊' },

  // ── Taxes (Annual) ───────────────────────────────────────────────────────
  { name: 'Federal Tax', group: 'Taxes', type: TransactionType.EXPENSE, budgetTier: 'annual', color: '#64748b', icon: '🏛️' },
  { name: 'State Tax', group: 'Taxes', type: TransactionType.EXPENSE, budgetTier: 'annual', color: '#475569', icon: '🏛️' },
  { name: 'Tax Preparation', group: 'Taxes', type: TransactionType.EXPENSE, budgetTier: 'annual', color: '#334155', icon: '📄' },

  // ── Charitable Giving (Flexible) ─────────────────────────────────────────
  { name: 'Donations', group: 'Charitable Giving', type: TransactionType.EXPENSE, budgetTier: 'flexible', color: '#f472b6', icon: '❤️' },
  { name: 'Tithes & Offerings', group: 'Charitable Giving', type: TransactionType.EXPENSE, budgetTier: 'fixed', color: '#ec4899', icon: '⛪' },

  // ── Miscellaneous ────────────────────────────────────────────────────────
  { name: 'Fees & Charges', group: 'Miscellaneous', type: TransactionType.EXPENSE, budgetTier: null, color: '#94a3b8', icon: '💸' },
  { name: 'Uncategorized', group: 'Miscellaneous', type: TransactionType.EXPENSE, budgetTier: null, color: '#cbd5e1', icon: null },

  // ── Transfer ─────────────────────────────────────────────────────────────
  { name: 'Transfer', group: 'Transfer', type: TransactionType.TRANSFER, budgetTier: null, color: '#f59e0b', icon: '🔄' },
]

async function main() {
  // 1. Create demo user
  const user = await db.user.upsert({
    where: { email: 'demo@clear-path.app' },
    update: {},
    create: {
      email: 'demo@clear-path.app',
      name: 'Demo User',
      password: 'hashed-password-placeholder',
    },
  })

  // 2. Seed system-level default categories (no userId)
  for (const cat of DEFAULT_CATEGORIES) {
    const existing = await db.category.findFirst({
      where: { name: cat.name, type: cat.type, userId: null },
    })
    if (!existing) {
      await db.category.create({
        data: {
          name: cat.name,
          group: cat.group,
          type: cat.type,
          budgetTier: cat.budgetTier,
          color: cat.color,
          icon: cat.icon,
          isDefault: true,
          isActive: true,
          userId: null,
        },
      })
    }
  }

  // 3. Create demo accounts
  const checking = await db.account.create({
    data: { userId: user.id, name: 'Main Checking', type: AccountType.CHECKING, balance: 3500 },
  })
  await db.account.create({
    data: { userId: user.id, name: 'Savings', type: AccountType.SAVINGS, balance: 12000 },
  })

  // 4. Look up seeded categories for demo transactions
  const groceries = await db.category.findFirst({
    where: { name: 'Groceries', type: TransactionType.EXPENSE, userId: null },
  })
  const salary = await db.category.findFirst({
    where: { name: 'Salary & Wages', type: TransactionType.INCOME, userId: null },
  })

  // 5. Create demo transactions
  await db.transaction.createMany({
    data: [
      {
        userId: user.id,
        accountId: checking.id,
        categoryId: salary?.id ?? null,
        amount: 5000,
        merchant: 'Acme Corp',
        date: new Date('2026-02-01'),
      },
      {
        userId: user.id,
        accountId: checking.id,
        categoryId: groceries?.id ?? null,
        amount: -120.5,
        merchant: 'Whole Foods Market',
        date: new Date('2026-02-10'),
      },
    ],
  })

  // 6. Create demo budget (no spent field — calculated from transactions)
  await db.budget.create({
    data: {
      userId: user.id,
      categoryId: groceries?.id ?? null,
      name: 'Grocery Budget',
      amount: 500,
      tier: 'flexible',
      startDate: new Date('2026-02-01'),
    },
  })

  console.log('Seed complete. Demo user: demo@clear-path.app')
  console.log(`  ${DEFAULT_CATEGORIES.length} default categories seeded`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
