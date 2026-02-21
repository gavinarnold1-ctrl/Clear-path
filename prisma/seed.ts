/**
 * Seed script — populates the database with demo data for local development.
 * Run with: npm run db:seed
 */
import { PrismaClient, TransactionType, AccountType, BudgetPeriod } from '@prisma/client'

const db = new PrismaClient()

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

  // Accounts
  const checking = await db.account.create({
    data: { userId: user.id, name: 'Main Checking', type: AccountType.CHECKING, balance: 3500 },
  })
  await db.account.create({
    data: { userId: user.id, name: 'Savings', type: AccountType.SAVINGS, balance: 12000 },
  })

  // Categories
  const groceries = await db.category.create({
    data: { userId: user.id, name: 'Groceries', color: '#22c55e', type: TransactionType.EXPENSE },
  })
  const salary = await db.category.create({
    data: { userId: user.id, name: 'Salary', color: '#6366f1', type: TransactionType.INCOME },
  })
  await db.category.create({
    data: { userId: user.id, name: 'Rent', color: '#ef4444', type: TransactionType.EXPENSE },
  })

  // Transactions
  await db.transaction.createMany({
    data: [
      {
        userId: user.id,
        accountId: checking.id,
        categoryId: salary.id,
        amount: 5000,
        description: 'Monthly salary',
        date: new Date('2026-02-01'),
        type: TransactionType.INCOME,
      },
      {
        userId: user.id,
        accountId: checking.id,
        categoryId: groceries.id,
        amount: 120.5,
        description: 'Weekly groceries',
        date: new Date('2026-02-10'),
        type: TransactionType.EXPENSE,
      },
    ],
  })

  // Budget
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

  console.log('✅ Seed complete. Demo user: demo@clear-path.app')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
