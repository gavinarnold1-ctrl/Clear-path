/**
 * Demo data seed logic — importable by both the standalone seed script
 * and the cron reset API route.
 */
import type { PrismaClient } from '@prisma/client'
import { Prisma, AccountType, BudgetPeriod, BudgetTier } from '@prisma/client'
import { hashPassword } from '@/lib/password'
import { DEMO_USER_ID, DEMO_USER_EMAIL } from '@/lib/demo'

// ─── Helpers ───────────────────────────────────────────────────────────────

function monthsAgo(months: number, day: number): Date {
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  d.setDate(Math.min(day, 28))
  d.setHours(12, 0, 0, 0)
  return d
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randAmount(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ─── Main seed function ────────────────────────────────────────────────────

export async function seedDemoData(db: PrismaClient): Promise<void> {
  // Clean up existing demo data
  const existing = await db.user.findUnique({ where: { id: DEMO_USER_ID } })
  if (existing) {
    // Clean up entity system models (must precede parent deletions)
    await db.transactionSplit.deleteMany({ where: { transaction: { userId: DEMO_USER_ID } } })
    await db.splitMatchRule.deleteMany({ where: { propertyGroup: { userId: DEMO_USER_ID } } })
    await db.splitRule.deleteMany({ where: { propertyGroup: { userId: DEMO_USER_ID } } })
    await db.accountPropertyLink.deleteMany({ where: { account: { userId: DEMO_USER_ID } } })
    await db.debt.deleteMany({ where: { userId: DEMO_USER_ID } })
    await db.propertyGroup.deleteMany({ where: { userId: DEMO_USER_ID } })

    await db.transaction.deleteMany({ where: { userId: DEMO_USER_ID } })
    await db.annualExpense.deleteMany({ where: { userId: DEMO_USER_ID } })
    await db.budget.deleteMany({ where: { userId: DEMO_USER_ID } })
    await db.insightFeedback.deleteMany({ where: { userId: DEMO_USER_ID } })
    await db.insight.deleteMany({ where: { userId: DEMO_USER_ID } })
    await db.efficiencyScore.deleteMany({ where: { userId: DEMO_USER_ID } })
    await db.account.deleteMany({ where: { userId: DEMO_USER_ID } })
    await db.category.deleteMany({ where: { userId: DEMO_USER_ID } })
    await db.householdMember.deleteMany({ where: { userId: DEMO_USER_ID } })
    await db.property.deleteMany({ where: { userId: DEMO_USER_ID } })
    await db.userProfile.deleteMany({ where: { userId: DEMO_USER_ID } })
    await db.user.delete({ where: { id: DEMO_USER_ID } })
  }

  // Create demo user (password: "demo1234")
  const passwordHash = await hashPassword('demo1234')
  await db.user.create({
    data: {
      id: DEMO_USER_ID,
      email: DEMO_USER_EMAIL,
      name: 'Alex Demo',
      password: passwordHash,
      profile: {
        create: {
          onboardingCompleted: true,
          onboardingCompletedAt: new Date(),
          onboardingStep: 3,
          primaryGoal: 'gain_visibility',
          householdType: 'single',
          incomeRange: '100k_150k',
          goalSetAt: new Date(),
        },
      },
    },
  })

  // ─── Categories ──────────────────────────────────────────────────────
  const categoryDefs = [
    { type: 'income', group: 'Income', name: 'Paychecks', icon: '💵' },
    { type: 'income', group: 'Income', name: 'Side Gig', icon: '💰' },
    { type: 'income', group: 'Income', name: 'Dividends & Capital Gains', icon: '📈' },
    { type: 'expense', group: 'Housing', name: 'Rent', icon: '🏠', budgetTier: 'FIXED' as const },
    { type: 'expense', group: 'Housing', name: 'Mortgage', icon: '🏡', budgetTier: 'FIXED' as const },
    { type: 'income', group: 'Income', name: 'Rental Income', icon: '🏘️' },
    { type: 'expense', group: 'Auto & Transport', name: 'Auto Payment', icon: '🚗', budgetTier: 'FIXED' as const },
    { type: 'expense', group: 'Financial', name: 'Insurance', icon: '☂️', budgetTier: 'FIXED' as const },
    { type: 'expense', group: 'Bills & Utilities', name: 'Gas & Electric', icon: '⚡️', budgetTier: 'FIXED' as const },
    { type: 'expense', group: 'Bills & Utilities', name: 'Internet & Cable', icon: '🌐', budgetTier: 'FIXED' as const },
    { type: 'expense', group: 'Travel & Lifestyle', name: 'Subscriptions', icon: '📺', budgetTier: 'FIXED' as const },
    { type: 'expense', group: 'Health & Wellness', name: 'Fitness', icon: '💪', budgetTier: 'FIXED' as const },
    { type: 'expense', group: 'Food & Dining', name: 'Groceries', icon: '🍏', budgetTier: 'FLEXIBLE' as const },
    { type: 'expense', group: 'Food & Dining', name: 'Restaurants & Bars', icon: '🍽️', budgetTier: 'FLEXIBLE' as const },
    { type: 'expense', group: 'Auto & Transport', name: 'Gas', icon: '⛽️', budgetTier: 'FLEXIBLE' as const },
    { type: 'expense', group: 'Travel & Lifestyle', name: 'Entertainment & Recreation', icon: '🎥', budgetTier: 'FLEXIBLE' as const },
    { type: 'expense', group: 'Shopping', name: 'Clothing', icon: '👕', budgetTier: 'FLEXIBLE' as const },
    { type: 'expense', group: 'Health & Wellness', name: 'Personal Care', icon: '💇', budgetTier: 'FLEXIBLE' as const },
    { type: 'expense', group: 'Auto & Transport', name: 'Auto Maintenance', icon: '🔧', budgetTier: 'ANNUAL' as const },
    { type: 'expense', group: 'Gifts & Donations', name: 'Gifts', icon: '🎁', budgetTier: 'ANNUAL' as const },
    { type: 'expense', group: 'Travel & Lifestyle', name: 'Travel & Vacation', icon: '🏝️', budgetTier: 'ANNUAL' as const },
    { type: 'transfer', group: 'Transfers', name: 'Transfer', icon: '🔄' },
    { type: 'transfer', group: 'Transfers', name: 'Credit Card Payment', icon: '💳' },
  ]

  const categoryMap = new Map<string, string>()
  for (const cat of categoryDefs) {
    const created = await db.category.create({
      data: {
        userId: DEMO_USER_ID,
        type: cat.type,
        group: cat.group,
        name: cat.name,
        icon: cat.icon,
        budgetTier: cat.budgetTier ?? null,
        isDefault: false,
      },
    })
    categoryMap.set(cat.name, created.id)
  }

  // ─── Accounts ────────────────────────────────────────────────────────
  const checking = await db.account.create({
    data: { userId: DEMO_USER_ID, name: 'Checking', type: AccountType.CHECKING, balance: 0 },
  })
  const savings = await db.account.create({
    data: { userId: DEMO_USER_ID, name: 'Savings', type: AccountType.SAVINGS, balance: 8500 },
  })
  const creditCard = await db.account.create({
    data: { userId: DEMO_USER_ID, name: 'Credit Card', type: AccountType.CREDIT_CARD, balance: 0 },
  })

  // ─── Transactions ────────────────────────────────────────────────────
  const allTransactions: {
    userId: string
    accountId: string
    categoryId: string | null
    amount: number
    merchant: string
    date: Date
    importSource: string
    propertyId?: string | null
    classification?: string
  }[] = []

  function addTx(
    accountId: string,
    categoryName: string | null,
    amount: number,
    merchant: string,
    date: Date,
    extra?: { propertyId?: string; classification?: string }
  ) {
    allTransactions.push({
      userId: DEMO_USER_ID,
      accountId,
      categoryId: categoryName ? categoryMap.get(categoryName) ?? null : null,
      amount,
      merchant,
      date,
      importSource: 'manual',
      propertyId: extra?.propertyId ?? null,
      classification: extra?.classification ?? (amount > 0 ? 'income' : 'expense'),
    })
  }

  // 4 months of data (current + 3 prior)
  for (let m = 3; m >= 0; m--) {
    // Income
    addTx(checking.id, 'Paychecks', 5200, 'Acme Corp — Payroll', monthsAgo(m, 1))
    if (randInt(0, 1)) {
      addTx(checking.id, 'Side Gig', randAmount(400, 600), 'Freelance Design', monthsAgo(m, randInt(15, 20)))
    }

    // Fixed expenses
    addTx(checking.id, 'Rent', -1450, 'Lakewood Apartments', monthsAgo(m, 1))
    addTx(checking.id, 'Auto Payment', -387, 'Honda Financial Services', monthsAgo(m, 5))
    addTx(checking.id, 'Insurance', -142, 'Progressive Insurance', monthsAgo(m, 12))
    addTx(checking.id, 'Gas & Electric', -randAmount(85, 130), 'National Grid', monthsAgo(m, randInt(18, 22)))
    addTx(checking.id, 'Internet & Cable', -65, 'Comcast Xfinity', monthsAgo(m, 8))
    addTx(checking.id, 'Subscriptions', -10.99, 'Spotify', monthsAgo(m, 3))
    addTx(checking.id, 'Subscriptions', -2.99, 'Apple iCloud', monthsAgo(m, 3))
    addTx(checking.id, 'Fitness', -49.99, 'Planet Fitness', monthsAgo(m, 1))

    // Groceries (8-12 per month)
    const groceryMerchants = ["Trader Joe's", 'Stop & Shop', 'Whole Foods', 'Aldi']
    const groceryCount = randInt(8, 12)
    for (let i = 0; i < groceryCount; i++) {
      addTx(
        pick([checking.id, creditCard.id]),
        'Groceries',
        -randAmount(25, 120),
        pick(groceryMerchants),
        monthsAgo(m, randInt(1, 28))
      )
    }

    // Dining (6-10 per month)
    const diningMerchants = ['Chipotle', 'Local Pub & Grill', "Domino's", 'Starbucks', 'Thai Basil', 'Panera Bread']
    const diningCount = randInt(6, 10)
    for (let i = 0; i < diningCount; i++) {
      addTx(
        pick([checking.id, creditCard.id]),
        'Restaurants & Bars',
        -randAmount(12, 65),
        pick(diningMerchants),
        monthsAgo(m, randInt(1, 28))
      )
    }

    // Gas (3-4 per month)
    const gasCount = randInt(3, 4)
    for (let i = 0; i < gasCount; i++) {
      addTx(creditCard.id, 'Gas', -randAmount(35, 55), pick(['Shell', 'Sunoco']), monthsAgo(m, randInt(1, 28)))
    }

    // Entertainment (2-4 per month)
    const entertainmentMerchants = ['AMC Theatres', 'Steam', 'Barnes & Noble', 'Spotify Premium']
    const entertainCount = randInt(2, 4)
    for (let i = 0; i < entertainCount; i++) {
      addTx(
        creditCard.id,
        'Entertainment & Recreation',
        -randAmount(10, 50),
        pick(entertainmentMerchants),
        monthsAgo(m, randInt(1, 28))
      )
    }

    // Clothing (1-2 some months)
    if (randInt(0, 1)) {
      const clothingCount = randInt(1, 2)
      for (let i = 0; i < clothingCount; i++) {
        addTx(creditCard.id, 'Clothing', -randAmount(30, 80), pick(['Target', 'Uniqlo', 'H&M']), monthsAgo(m, randInt(5, 25)))
      }
    }

    // Personal Care (1-2 per month)
    const pcCount = randInt(1, 2)
    for (let i = 0; i < pcCount; i++) {
      addTx(creditCard.id, 'Personal Care', -randAmount(15, 45), pick(['CVS', 'Great Clips', 'Walgreens']), monthsAgo(m, randInt(3, 27)))
    }
  }

  // Annual one-time hits
  addTx(checking.id, 'Auto Maintenance', -245, 'DMV — Vehicle Registration', monthsAgo(2, 15))

  // Vacation spending 1 month ago
  addTx(creditCard.id, 'Travel & Vacation', -340, 'Airbnb', monthsAgo(1, 8))
  addTx(creditCard.id, 'Travel & Vacation', -260, 'Southwest Airlines', monthsAgo(1, 5))
  addTx(creditCard.id, 'Travel & Vacation', -200, 'Restaurant — Vacation', monthsAgo(1, 10))

  // Recent transactions (last few days)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const twoDaysAgo = new Date(today)
  twoDaysAgo.setDate(today.getDate() - 2)

  addTx(creditCard.id, 'Groceries', -67.42, "Trader Joe's", twoDaysAgo)
  addTx(creditCard.id, 'Restaurants & Bars', -28.5, 'Starbucks', yesterday)
  addTx(checking.id, 'Gas', -42.18, 'Shell', yesterday)

  // ─── Current month guaranteed transactions ──────────────────────────
  // Ensure dashboard, spending, and budget pages always show data even
  // early in the month when random-date transactions may fall in the future.

  // Income
  addTx(checking.id, 'Paychecks', 4200, 'Employer Direct Deposit', monthsAgo(0, 1))
  addTx(checking.id, 'Paychecks', 4200, 'Employer Direct Deposit', monthsAgo(0, 15))

  // Fixed expenses
  addTx(checking.id, 'Rent', -1850, 'Property Management Co', monthsAgo(0, 1))
  addTx(checking.id, 'Gas & Electric', -145, 'Electric Company', monthsAgo(0, 5))
  addTx(checking.id, 'Insurance', -180, 'State Farm', monthsAgo(0, 3))
  addTx(creditCard.id, 'Internet & Cable', -89.99, 'Verizon', monthsAgo(0, 7))
  addTx(creditCard.id, 'Subscriptions', -15.99, 'Netflix', monthsAgo(0, 4))
  addTx(creditCard.id, 'Subscriptions', -10.99, 'Spotify', monthsAgo(0, 4))

  // Flexible spending
  addTx(creditCard.id, 'Groceries', -68.33, 'Whole Foods', monthsAgo(0, 2))
  addTx(creditCard.id, 'Groceries', -52.17, "Trader Joe's", monthsAgo(0, 5))
  addTx(creditCard.id, 'Restaurants & Bars', -43.5, 'Chipotle', monthsAgo(0, 3))
  addTx(creditCard.id, 'Gas', -48.2, 'Shell', monthsAgo(0, 1))
  addTx(creditCard.id, 'Clothing', -34.99, 'Amazon', monthsAgo(0, 6))
  addTx(creditCard.id, 'Restaurants & Bars', -6.75, 'Blue Bottle Coffee', monthsAgo(0, 2))
  addTx(creditCard.id, 'Restaurants & Bars', -5.5, 'Blue Bottle Coffee', monthsAgo(0, 5))
  addTx(creditCard.id, 'Fitness', -50, 'Planet Fitness', monthsAgo(0, 1))

  // Write all transactions
  await db.transaction.createMany({ data: allTransactions })

  // Update account balances
  const accountBalances = new Map<string, number>()
  for (const tx of allTransactions) {
    accountBalances.set(tx.accountId, (accountBalances.get(tx.accountId) ?? 0) + tx.amount)
  }
  for (const [accountId, delta] of accountBalances) {
    await db.account.update({
      where: { id: accountId },
      data: { balance: { increment: delta } },
    })
  }

  // ─── Budgets ─────────────────────────────────────────────────────────
  const now = new Date()
  const budgetStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const yearStart = new Date(now.getFullYear(), 0, 1)

  const fixedBudgets = [
    { name: 'Rent', category: 'Rent', amount: 1450, dueDay: 1, isAutoPay: true, varianceLimit: 0 },
    { name: 'Car Payment', category: 'Auto Payment', amount: 387, dueDay: 5, isAutoPay: true, varianceLimit: 0 },
    { name: 'Insurance', category: 'Insurance', amount: 142, dueDay: 12, isAutoPay: true, varianceLimit: 5 },
    { name: 'Electric', category: 'Gas & Electric', amount: 130, dueDay: 20, isAutoPay: false, varianceLimit: 30 },
    { name: 'Internet', category: 'Internet & Cable', amount: 65, dueDay: 8, isAutoPay: true, varianceLimit: 0 },
    { name: 'Subscriptions', category: 'Subscriptions', amount: 15, dueDay: 3, isAutoPay: true, varianceLimit: 2 },
    { name: 'Gym', category: 'Fitness', amount: 49.99, dueDay: 1, isAutoPay: true, varianceLimit: 0 },
  ]

  for (const fb of fixedBudgets) {
    await db.budget.create({
      data: {
        userId: DEMO_USER_ID,
        categoryId: categoryMap.get(fb.category) ?? null,
        name: fb.name,
        amount: fb.amount,

        period: BudgetPeriod.MONTHLY,
        tier: BudgetTier.FIXED,
        startDate: budgetStart,
        isAutoPay: fb.isAutoPay,
        dueDay: fb.dueDay,
        varianceLimit: fb.varianceLimit,
      },
    })
  }

  const flexibleBudgets = [
    { name: 'Groceries', category: 'Groceries', amount: 500 },
    { name: 'Dining Out', category: 'Restaurants & Bars', amount: 200 },
    { name: 'Gas', category: 'Gas', amount: 180 },
    { name: 'Entertainment', category: 'Entertainment & Recreation', amount: 100 },
    { name: 'Clothing', category: 'Clothing', amount: 100 },
  ]

  for (const fb of flexibleBudgets) {
    await db.budget.create({
      data: {
        userId: DEMO_USER_ID,
        categoryId: categoryMap.get(fb.category) ?? null,
        name: fb.name,
        amount: fb.amount,

        period: BudgetPeriod.MONTHLY,
        tier: BudgetTier.FLEXIBLE,
        startDate: budgetStart,
      },
    })
  }

  // Annual budget + expense
  const vacationCatId = categoryMap.get('Travel & Vacation')
  if (vacationCatId) {
    const vacBudget = await db.budget.create({
      data: {
        userId: DEMO_USER_ID,
        categoryId: vacationCatId,
        name: 'Vacation Fund',
        amount: 250,

        period: BudgetPeriod.MONTHLY,
        tier: BudgetTier.ANNUAL,
        startDate: yearStart,
      },
    })

    await db.annualExpense.create({
      data: {
        userId: DEMO_USER_ID,
        budgetId: vacBudget.id,
        name: 'Summer Vacation',
        annualAmount: 3000,
        dueMonth: 7,
        dueYear: now.getFullYear(),
        monthlySetAside: 250,
        funded: 500,
        isRecurring: false,
        status: 'planned',
      },
    })
  }

  // ─── Properties ─────────────────────────────────────────────────────
  const primaryHome = await db.property.create({
    data: {
      userId: DEMO_USER_ID,
      name: '456 Oak Ave',
      type: 'PERSONAL',
      taxSchedule: 'SCHEDULE_A',
    },
  })

  const rentalProperty = await db.property.create({
    data: {
      userId: DEMO_USER_ID,
      name: '123 Main St',
      type: 'RENTAL',
      taxSchedule: 'SCHEDULE_E',
      purchasePrice: new Prisma.Decimal(265000),
      purchaseDate: new Date('2021-03-01'),
      buildingValuePct: new Prisma.Decimal(80),
      priorDepreciation: new Prisma.Decimal(38545.45),
    },
  })

  // ─── Property Group with Split Rules ────────────────────────────────
  const propGroup = await db.propertyGroup.create({
    data: {
      userId: DEMO_USER_ID,
      name: 'All Properties',
      description: 'Shared expenses split 50/50 between primary and rental',
    },
  })

  await db.property.update({
    where: { id: primaryHome.id },
    data: { groupId: propGroup.id, splitPct: new Prisma.Decimal(50) },
  })
  await db.property.update({
    where: { id: rentalProperty.id },
    data: { groupId: propGroup.id, splitPct: new Prisma.Decimal(50) },
  })

  // Split rules (allocation per property within the group)
  await db.splitRule.create({
    data: { propertyGroupId: propGroup.id, propertyId: primaryHome.id, allocationPct: new Prisma.Decimal(50) },
  })
  await db.splitRule.create({
    data: { propertyGroupId: propGroup.id, propertyId: rentalProperty.id, allocationPct: new Prisma.Decimal(50) },
  })

  // Match rule for auto-splitting mortgage payments
  await db.splitMatchRule.create({
    data: {
      propertyGroupId: propGroup.id,
      name: 'Mortgage payments',
      matchField: 'CATEGORY',
      matchPattern: 'Mortgage',
      allocations: [
        { propertyId: primaryHome.id, percentage: 50 },
        { propertyId: rentalProperty.id, percentage: 50 },
      ],
      isActive: true,
    },
  })

  // ─── Account-Property Link ──────────────────────────────────────────
  await db.accountPropertyLink.create({
    data: {
      accountId: checking.id,
      propertyId: primaryHome.id,
    },
  })

  // ─── Debts ──────────────────────────────────────────────────────────
  const mortgageCatId = categoryMap.get('Mortgage')

  await db.debt.create({
    data: {
      userId: DEMO_USER_ID,
      name: 'Mortgage \u2013 456 Oak Ave',
      type: 'MORTGAGE',
      currentBalance: 310000,
      originalBalance: 340000,
      interestRate: 0.0625,
      minimumPayment: 2350,
      escrowAmount: 400,
      paymentDay: 1,
      termMonths: 360,
      startDate: new Date('2022-06-01'),
      propertyId: primaryHome.id,
      categoryId: mortgageCatId ?? null,
    },
  })

  await db.debt.create({
    data: {
      userId: DEMO_USER_ID,
      name: 'Chase Sapphire',
      type: 'CREDIT_CARD',
      currentBalance: 5290.14,
      interestRate: 0.2499,
      minimumPayment: 132,
      paymentDay: 15,
      accountId: creditCard.id,
    },
  })

  // ─── Property-attributed Transactions ───────────────────────────────
  // Mortgage payments for primary home (3 months)
  for (const month of [1, 2, 3]) {
    addTx(
      checking.id, 'Mortgage', -2350, 'US Bank Mortgage',
      new Date(2026, month - 1, 1),
      { propertyId: primaryHome.id }
    )
  }

  // Rental income + rental mortgage expense (3 months)
  for (const month of [1, 2, 3]) {
    addTx(
      checking.id, 'Rental Income', 1850, 'Tenant Payment',
      new Date(2026, month - 1, 5),
      { propertyId: rentalProperty.id, classification: 'income' }
    )
    addTx(
      checking.id, 'Mortgage', -1800, 'Wells Fargo Mortgage',
      new Date(2026, month - 1, 1),
      { propertyId: rentalProperty.id }
    )
  }

  // Write property-attributed transactions separately (main batch was already written)
  const propertyTxs = allTransactions.filter(tx => tx.propertyId)
  if (propertyTxs.length > 0) {
    await db.transaction.createMany({ data: propertyTxs })
    for (const tx of propertyTxs) {
      await db.account.update({
        where: { id: tx.accountId },
        data: { balance: { increment: tx.amount } },
      })
    }
  }
}
