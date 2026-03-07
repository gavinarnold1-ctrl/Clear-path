/**
 * Demo data seed logic — importable by both the standalone seed script
 * and the cron reset API route.
 */
import type { PrismaClient } from '@prisma/client'
import { Prisma, AccountType, BudgetPeriod, BudgetTier } from '@prisma/client'
import { hashPassword } from '@/lib/password'
import { DEMO_USER_ID, DEMO_USER_EMAIL } from '@/lib/demo'
import { DEFAULT_CATEGORIES } from '@/lib/seed-categories'

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
    await db.monthlySnapshot.deleteMany({ where: { userId: DEMO_USER_ID } })
    await db.account.deleteMany({ where: { userId: DEMO_USER_ID } })
    await db.category.deleteMany({ where: { userId: DEMO_USER_ID } })
    await db.householdMember.deleteMany({ where: { userId: DEMO_USER_ID } })
    await db.property.deleteMany({ where: { userId: DEMO_USER_ID } })
    await db.userProfile.deleteMany({ where: { userId: DEMO_USER_ID } })
    await db.user.delete({ where: { id: DEMO_USER_ID } })
  }

  const now = new Date()

  // ─── Change 1: Enhanced profile with save_more goal ────────────────
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
          primaryGoal: 'save_more',
          householdType: 'shared_partner',
          incomeRange: '150k_200k',
          expectedMonthlyIncome: 14583,
          goalSetAt: new Date(),
          goalTarget: {
            archetype: 'save_more',
            metric: 'savings_amount',
            targetValue: 25000,
            targetDate: '2027-06-30',
            startValue: 8500,
            label: 'Save $25K emergency fund',
          },
          incomeTransitions: [
            {
              id: 'it_demo_raise',
              date: new Date(now.getFullYear(), now.getMonth() + 3, 1).toISOString().slice(0, 10),
              monthlyIncome: 15312,
              label: 'Annual raise (5%)',
              annualIncome: 183750,
            },
            {
              id: 'it_demo_newjob',
              date: new Date(now.getFullYear() + 1, now.getMonth(), 1).toISOString().slice(0, 10),
              monthlyIncome: 17500,
              label: 'New role at TechCo',
              annualIncome: 210000,
            },
          ],
        },
      },
    },
  })

  // ─── Household member: partner "Taylor" ────────────────────────────
  const alex = await db.householdMember.create({
    data: { userId: DEMO_USER_ID, name: 'Alex', isDefault: true },
  })
  const taylor = await db.householdMember.create({
    data: { userId: DEMO_USER_ID, name: 'Taylor', isDefault: false },
  })

  // ─── Categories ──────────────────────────────────────────────────────
  const demoIcons: Record<string, string> = {
    'Paychecks': '💵', 'Side Income': '💰', 'Rental Income': '🏘️',
    'Dividends & Interest': '📈', 'Other Income': '💸',
    'Mortgage': '🏡', 'Rent': '🏠', 'Home Improvement': '🔨',
    'Gas & Electric': '⚡️', 'Internet & Phone': '🌐', 'Water & Sewer': '💧',
    'Groceries': '🍏', 'Restaurants & Bars': '🍽️', 'Coffee Shops': '☕',
    'Gas & Fuel': '⛽️', 'Auto Payment': '🚗', 'Auto Insurance': '🛡️',
    'Medical': '🏥', 'Gym & Fitness': '💪',
    'Shopping': '🛍️', 'Clothing': '👕', 'Personal Care': '💇',
    'Entertainment': '🎥', 'Subscriptions': '📺', 'Travel & Vacation': '🏝️',
    'Insurance': '☂️', 'Bank Fees': '🏦', 'Loan Payment': '📋',
    'Gifts & Donations': '🎁', 'Uncategorized': '❓',
    'Transfer': '🔄', 'Credit Card Payment': '💳',
  }
  const demoBudgetTiers: Record<string, 'FIXED' | 'FLEXIBLE' | 'ANNUAL'> = {
    'Rent': 'FIXED', 'Mortgage': 'FIXED', 'Auto Payment': 'FIXED',
    'Insurance': 'FIXED', 'Gas & Electric': 'FIXED', 'Internet & Phone': 'FIXED',
    'Subscriptions': 'FIXED', 'Gym & Fitness': 'FIXED', 'Loan Payment': 'FIXED',
    'Groceries': 'FLEXIBLE', 'Restaurants & Bars': 'FLEXIBLE',
    'Gas & Fuel': 'FLEXIBLE', 'Entertainment': 'FLEXIBLE',
    'Clothing': 'FLEXIBLE', 'Personal Care': 'FLEXIBLE',
    'Auto Insurance': 'ANNUAL', 'Travel & Vacation': 'ANNUAL',
  }

  const demoExtraCategories = [
    { type: 'income', group: 'Income', name: 'Side Gig', icon: '💰' },
    { type: 'income', group: 'Income', name: 'Dividends & Capital Gains', icon: '📈' },
    { type: 'expense', group: 'Bills & Utilities', name: 'Internet & Cable', icon: '🌐', budgetTier: 'FIXED' as const },
    { type: 'expense', group: 'Health & Wellness', name: 'Fitness', icon: '💪', budgetTier: 'FIXED' as const },
    { type: 'expense', group: 'Auto & Transport', name: 'Gas', icon: '⛽️', budgetTier: 'FLEXIBLE' as const },
    { type: 'expense', group: 'Travel & Lifestyle', name: 'Entertainment & Recreation', icon: '🎥', budgetTier: 'FLEXIBLE' as const },
    { type: 'expense', group: 'Auto & Transport', name: 'Auto Maintenance', icon: '🔧', budgetTier: 'ANNUAL' as const },
    { type: 'expense', group: 'Gifts & Donations', name: 'Gifts', icon: '🎁', budgetTier: 'ANNUAL' as const },
  ]

  const categoryMap = new Map<string, string>()

  for (const cat of DEFAULT_CATEGORIES) {
    const created = await db.category.create({
      data: {
        userId: DEMO_USER_ID,
        type: cat.type,
        group: cat.group,
        name: cat.name,
        icon: demoIcons[cat.name] ?? null,
        budgetTier: demoBudgetTiers[cat.name] ?? null,
        isDefault: false,
      },
    })
    categoryMap.set(cat.name, created.id)
  }

  for (const cat of demoExtraCategories) {
    const created = await db.category.create({
      data: {
        userId: DEMO_USER_ID,
        type: cat.type,
        group: cat.group,
        name: cat.name,
        icon: cat.icon ?? null,
        budgetTier: cat.budgetTier ?? null,
        isDefault: false,
      },
    })
    categoryMap.set(cat.name, created.id)
  }

  // ─── Change 2: Richer Accounts ─────────────────────────────────────
  const checking = await db.account.create({
    data: { userId: DEMO_USER_ID, name: 'Checking', type: AccountType.CHECKING, balance: 4200 },
  })
  const savings = await db.account.create({
    data: { userId: DEMO_USER_ID, name: 'Savings', type: AccountType.SAVINGS, balance: 8500 },
  })
  const creditCard = await db.account.create({
    data: { userId: DEMO_USER_ID, name: 'Credit Card', type: AccountType.CREDIT_CARD, balance: 0 },
  })
  const retirement = await db.account.create({
    data: {
      userId: DEMO_USER_ID,
      name: '401(k)',
      type: AccountType.INVESTMENT,
      balance: 45000,
      assetClass: 'STOCKS',
      expectedReturn: 0.08,
    },
  })
  const studentLoanAcct = await db.account.create({
    data: {
      userId: DEMO_USER_ID,
      name: 'Student Loans',
      type: AccountType.STUDENT_LOAN,
      balance: -32000,
    },
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
    householdMemberId?: string | null
    classification?: string
  }[] = []

  function addTx(
    accountId: string,
    categoryName: string | null,
    amount: number,
    merchant: string,
    date: Date,
    extra?: { propertyId?: string; householdMemberId?: string; classification?: string }
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
      householdMemberId: extra?.householdMemberId ?? null,
      classification: extra?.classification ?? (amount > 0 ? 'income' : 'expense'),
    })
  }

  // Shared categories where Taylor gets tagged ~30% of the time
  const sharedCategories = ['Groceries', 'Restaurants & Bars', 'Entertainment & Recreation', 'Gas']

  function partnerTag(categoryName: string | null): { householdMemberId?: string } {
    if (categoryName && sharedCategories.includes(categoryName) && Math.random() < 0.3) {
      return { householdMemberId: taylor.id }
    }
    return {}
  }

  // ─── Change 8: Richer recurring transactions ──────────────────────
  // 6 months of data (current + 5 prior) for deeper history
  for (let m = 5; m >= 0; m--) {
    // Income — bi-weekly paycheck pattern
    addTx(checking.id, 'Paychecks', 7292, 'Acme Corp — Payroll', monthsAgo(m, 1))
    addTx(checking.id, 'Paychecks', 7291, 'Acme Corp — Payroll', monthsAgo(m, 15))

    // Side income (intermittent)
    if (randInt(0, 2) === 0) {
      addTx(checking.id, 'Side Gig', randAmount(400, 800), 'Freelance Design', monthsAgo(m, randInt(15, 20)))
    }

    // Fixed expenses
    addTx(checking.id, 'Rent', -1850, 'Lakewood Apartments', monthsAgo(m, 1))
    addTx(checking.id, 'Auto Payment', -387, 'Honda Financial Services', monthsAgo(m, 5))
    addTx(checking.id, 'Insurance', -180, 'State Farm', monthsAgo(m, 3))
    addTx(checking.id, 'Gas & Electric', -randAmount(95, 145), 'National Grid', monthsAgo(m, randInt(18, 22)))
    addTx(checking.id, 'Internet & Cable', -89.99, 'Verizon Fios', monthsAgo(m, 8))

    // Explicit recurring subscriptions (Change 8)
    addTx(creditCard.id, 'Subscriptions', -15.99, 'Netflix', monthsAgo(m, 4))
    addTx(creditCard.id, 'Subscriptions', -10.99, 'Spotify Family', monthsAgo(m, 4))
    addTx(creditCard.id, 'Subscriptions', -2.99, 'Apple iCloud+', monthsAgo(m, 3))
    addTx(creditCard.id, 'Subscriptions', -17.00, 'NYT Digital', monthsAgo(m, 12))
    addTx(checking.id, 'Fitness', -49.99, 'Planet Fitness', monthsAgo(m, 1))

    // Student loan payment (Change 3)
    addTx(checking.id, 'Loan Payment', -345, 'FedLoan Servicing', monthsAgo(m, 20))

    // Groceries (8-12 per month, ~30% tagged to Taylor)
    const groceryMerchants = ["Trader Joe's", 'Stop & Shop', 'Whole Foods', 'Aldi', 'Costco']
    const groceryCount = randInt(8, 12)
    for (let i = 0; i < groceryCount; i++) {
      addTx(
        pick([checking.id, creditCard.id]),
        'Groceries',
        -randAmount(25, 130),
        pick(groceryMerchants),
        monthsAgo(m, randInt(1, 28)),
        partnerTag('Groceries')
      )
    }

    // Dining (6-10 per month)
    const diningMerchants = ['Chipotle', 'Local Pub & Grill', "Domino's", 'Starbucks', 'Thai Basil', 'Panera Bread', 'Sweetgreen']
    const diningCount = randInt(6, 10)
    for (let i = 0; i < diningCount; i++) {
      addTx(
        pick([checking.id, creditCard.id]),
        'Restaurants & Bars',
        -randAmount(12, 65),
        pick(diningMerchants),
        monthsAgo(m, randInt(1, 28)),
        partnerTag('Restaurants & Bars')
      )
    }

    // Gas (3-4 per month)
    const gasCount = randInt(3, 4)
    for (let i = 0; i < gasCount; i++) {
      addTx(
        creditCard.id, 'Gas', -randAmount(35, 55),
        pick(['Shell', 'Sunoco', 'Mobil']),
        monthsAgo(m, randInt(1, 28)),
        partnerTag('Gas')
      )
    }

    // Entertainment (2-4 per month)
    const entertainmentMerchants = ['AMC Theatres', 'Steam', 'Barnes & Noble', 'Ticketmaster']
    const entertainCount = randInt(2, 4)
    for (let i = 0; i < entertainCount; i++) {
      addTx(
        creditCard.id,
        'Entertainment & Recreation',
        -randAmount(10, 55),
        pick(entertainmentMerchants),
        monthsAgo(m, randInt(1, 28)),
        partnerTag('Entertainment & Recreation')
      )
    }

    // Clothing (1-2 some months)
    if (randInt(0, 1)) {
      const clothingCount = randInt(1, 2)
      for (let i = 0; i < clothingCount; i++) {
        addTx(creditCard.id, 'Clothing', -randAmount(30, 90), pick(['Target', 'Uniqlo', 'H&M', 'Amazon']), monthsAgo(m, randInt(5, 25)))
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
  addTx(checking.id, 'Auto Insurance', -612, 'GEICO — 6-Month Premium', monthsAgo(4, 10))

  // Vacation spending 1 month ago
  addTx(creditCard.id, 'Travel & Vacation', -340, 'Airbnb', monthsAgo(1, 8))
  addTx(creditCard.id, 'Travel & Vacation', -260, 'Southwest Airlines', monthsAgo(1, 5))
  addTx(creditCard.id, 'Travel & Vacation', -200, 'Restaurant — Vacation', monthsAgo(1, 10))

  // Gift spending (holiday, 3 months ago)
  addTx(creditCard.id, 'Gifts', -185, 'Amazon — Gift Orders', monthsAgo(3, 20))
  addTx(creditCard.id, 'Gifts', -95, 'Etsy', monthsAgo(3, 22))

  // Partner-specific transactions (Change 8)
  for (let m = 5; m >= 0; m--) {
    addTx(creditCard.id, 'Personal Care', -randAmount(20, 50), 'Sephora', monthsAgo(m, randInt(10, 20)), { householdMemberId: taylor.id })
    if (randInt(0, 1)) {
      addTx(creditCard.id, 'Clothing', -randAmount(25, 75), pick(['Zara', 'Nordstrom Rack']), monthsAgo(m, randInt(5, 25)), { householdMemberId: taylor.id })
    }
  }

  // Recent transactions (last few days)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const twoDaysAgo = new Date(today)
  twoDaysAgo.setDate(today.getDate() - 2)

  addTx(creditCard.id, 'Groceries', -67.42, "Trader Joe's", twoDaysAgo)
  addTx(creditCard.id, 'Restaurants & Bars', -28.5, 'Starbucks', yesterday, { householdMemberId: taylor.id })
  addTx(checking.id, 'Gas', -42.18, 'Shell', yesterday)

  // ─── Current month guaranteed transactions ──────────────────────────
  addTx(checking.id, 'Paychecks', 7292, 'Acme Corp — Payroll', monthsAgo(0, 1))
  addTx(checking.id, 'Paychecks', 7291, 'Acme Corp — Payroll', monthsAgo(0, 15))

  addTx(checking.id, 'Rent', -1850, 'Lakewood Apartments', monthsAgo(0, 1))
  addTx(checking.id, 'Gas & Electric', -145, 'National Grid', monthsAgo(0, 5))
  addTx(checking.id, 'Insurance', -180, 'State Farm', monthsAgo(0, 3))
  addTx(creditCard.id, 'Internet & Cable', -89.99, 'Verizon Fios', monthsAgo(0, 7))
  addTx(creditCard.id, 'Subscriptions', -15.99, 'Netflix', monthsAgo(0, 4))
  addTx(creditCard.id, 'Subscriptions', -10.99, 'Spotify Family', monthsAgo(0, 4))
  addTx(creditCard.id, 'Subscriptions', -17.00, 'NYT Digital', monthsAgo(0, 12))

  addTx(creditCard.id, 'Groceries', -68.33, 'Whole Foods', monthsAgo(0, 2))
  addTx(creditCard.id, 'Groceries', -52.17, "Trader Joe's", monthsAgo(0, 5), { householdMemberId: taylor.id })
  addTx(creditCard.id, 'Restaurants & Bars', -43.5, 'Chipotle', monthsAgo(0, 3))
  addTx(creditCard.id, 'Gas', -48.2, 'Shell', monthsAgo(0, 1))
  addTx(creditCard.id, 'Clothing', -34.99, 'Amazon', monthsAgo(0, 6))
  addTx(creditCard.id, 'Restaurants & Bars', -6.75, 'Blue Bottle Coffee', monthsAgo(0, 2), { householdMemberId: taylor.id })
  addTx(creditCard.id, 'Restaurants & Bars', -5.5, 'Blue Bottle Coffee', monthsAgo(0, 5))
  addTx(creditCard.id, 'Fitness', -49.99, 'Planet Fitness', monthsAgo(0, 1))
  addTx(checking.id, 'Loan Payment', -345, 'FedLoan Servicing', monthsAgo(0, 20))

  // Write all transactions
  await db.transaction.createMany({ data: allTransactions })

  // Update account balances from transactions
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
  const budgetStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const yearStart = new Date(now.getFullYear(), 0, 1)

  const fixedBudgets = [
    { name: 'Rent', category: 'Rent', amount: 1850, dueDay: 1, isAutoPay: true, varianceLimit: 0 },
    { name: 'Car Payment', category: 'Auto Payment', amount: 387, dueDay: 5, isAutoPay: true, varianceLimit: 0 },
    { name: 'Insurance', category: 'Insurance', amount: 180, dueDay: 3, isAutoPay: true, varianceLimit: 5 },
    { name: 'Electric', category: 'Gas & Electric', amount: 145, dueDay: 20, isAutoPay: false, varianceLimit: 30 },
    { name: 'Internet', category: 'Internet & Cable', amount: 89.99, dueDay: 8, isAutoPay: true, varianceLimit: 0 },
    { name: 'Subscriptions', category: 'Subscriptions', amount: 47, dueDay: 3, isAutoPay: true, varianceLimit: 2 },
    { name: 'Gym', category: 'Fitness', amount: 49.99, dueDay: 1, isAutoPay: true, varianceLimit: 0 },
    { name: 'Student Loan', category: 'Loan Payment', amount: 345, dueDay: 20, isAutoPay: true, varianceLimit: 0 },
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
    { name: 'Groceries', category: 'Groceries', amount: 600 },
    { name: 'Dining Out', category: 'Restaurants & Bars', amount: 250 },
    { name: 'Gas', category: 'Gas', amount: 180 },
    { name: 'Entertainment', category: 'Entertainment & Recreation', amount: 120 },
    { name: 'Clothing', category: 'Clothing', amount: 100 },
    { name: 'Personal Care', category: 'Personal Care', amount: 60 },
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

  // ─── Change 4: More Annual Expenses ────────────────────────────────
  const annualBudgetDefs = [
    {
      budgetName: 'Vacation Fund', category: 'Travel & Vacation', monthlyAmount: 250,
      expenseName: 'Summer Vacation', annualAmount: 3000, dueMonth: 7, funded: 500, status: 'planned' as const,
    },
    {
      budgetName: 'Auto Insurance', category: 'Auto Insurance', monthlyAmount: 100,
      expenseName: 'Auto Insurance Premium', annualAmount: 1200, dueMonth: 9, funded: 600, status: 'funded' as const,
    },
    {
      budgetName: 'Holiday Gifts', category: 'Gifts', monthlyAmount: 67,
      expenseName: 'Holiday Gifts', annualAmount: 800, dueMonth: 12, funded: 200, status: 'planned' as const,
    },
    {
      budgetName: 'Car Registration', category: 'Auto Maintenance', monthlyAmount: 21,
      expenseName: 'Vehicle Registration', annualAmount: 250, dueMonth: 5, funded: 84, status: 'planned' as const,
    },
  ]

  for (const abd of annualBudgetDefs) {
    const catId = categoryMap.get(abd.category)
    if (!catId) continue
    const budget = await db.budget.create({
      data: {
        userId: DEMO_USER_ID,
        categoryId: catId,
        name: abd.budgetName,
        amount: abd.monthlyAmount,
        period: BudgetPeriod.MONTHLY,
        tier: BudgetTier.ANNUAL,
        startDate: yearStart,
      },
    })
    await db.annualExpense.create({
      data: {
        userId: DEMO_USER_ID,
        budgetId: budget.id,
        name: abd.expenseName,
        annualAmount: abd.annualAmount,
        dueMonth: abd.dueMonth,
        dueYear: now.getFullYear(),
        monthlySetAside: abd.monthlyAmount,
        funded: abd.funded,
        isRecurring: true,
        status: abd.status,
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

  await db.splitRule.create({
    data: { propertyGroupId: propGroup.id, propertyId: primaryHome.id, allocationPct: new Prisma.Decimal(50) },
  })
  await db.splitRule.create({
    data: { propertyGroupId: propGroup.id, propertyId: rentalProperty.id, allocationPct: new Prisma.Decimal(50) },
  })

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
    data: { accountId: checking.id, propertyId: primaryHome.id },
  })

  // ─── Change 3: Debts (mortgage + credit card + student loan) ──────
  const mortgageCatId = categoryMap.get('Mortgage')
  const loanPaymentCatId = categoryMap.get('Loan Payment')

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

  await db.debt.create({
    data: {
      userId: DEMO_USER_ID,
      name: 'Federal Student Loans',
      type: 'STUDENT_LOAN',
      currentBalance: 32000,
      originalBalance: 38000,
      interestRate: 0.055,
      minimumPayment: 345,
      paymentDay: 20,
      termMonths: 120,
      startDate: new Date('2020-09-01'),
      accountId: studentLoanAcct.id,
      categoryId: loanPaymentCatId ?? null,
    },
  })

  // ─── Property-attributed Transactions (Change 8) ──────────────────
  // Mortgage payments for primary home (6 months)
  for (let m = 5; m >= 0; m--) {
    addTx(
      checking.id, 'Mortgage', -2350, 'US Bank Mortgage',
      monthsAgo(m, 1),
      { propertyId: primaryHome.id }
    )
  }

  // Rental income + rental mortgage + rental expenses (6 months)
  for (let m = 5; m >= 0; m--) {
    addTx(
      checking.id, 'Rental Income', 1850, 'Tenant Payment',
      monthsAgo(m, 5),
      { propertyId: rentalProperty.id, classification: 'income' }
    )
    addTx(
      checking.id, 'Mortgage', -1800, 'Wells Fargo Mortgage',
      monthsAgo(m, 1),
      { propertyId: rentalProperty.id }
    )
    // Rental property insurance (every other month)
    if (m % 2 === 0) {
      addTx(
        checking.id, 'Insurance', -125, 'Landlord Insurance Co',
        monthsAgo(m, 10),
        { propertyId: rentalProperty.id }
      )
    }
  }
  // Rental maintenance one-offs
  addTx(checking.id, 'Home Improvement', -450, 'Home Depot — Rental Repairs', monthsAgo(2, 18), { propertyId: rentalProperty.id })
  addTx(checking.id, 'Home Improvement', -180, 'Roto-Rooter', monthsAgo(4, 8), { propertyId: rentalProperty.id })

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

  // ─── Change 5: Monthly Snapshots (6 months) ──────────────────────
  const snapshotData = [
    { monthsBack: 5, totalIncome: 14583, totalExpenses: 11200, netWorth: 38500, totalDebt: 347290, savingsRate: 0.23 },
    { monthsBack: 4, totalIncome: 14583, totalExpenses: 11850, netWorth: 41200, totalDebt: 346800, savingsRate: 0.19 },
    { monthsBack: 3, totalIncome: 15083, totalExpenses: 12100, netWorth: 44100, totalDebt: 346200, savingsRate: 0.20 },
    { monthsBack: 2, totalIncome: 14583, totalExpenses: 11400, netWorth: 47300, totalDebt: 345600, savingsRate: 0.22 },
    { monthsBack: 1, totalIncome: 14583, totalExpenses: 12400, netWorth: 49600, totalDebt: 345000, savingsRate: 0.15 },
    { monthsBack: 0, totalIncome: 14583, totalExpenses: 10800, netWorth: 53400, totalDebt: 344400, savingsRate: 0.26 },
  ]

  for (const snap of snapshotData) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - snap.monthsBack, 1)
    const netSurplus = snap.totalIncome - snap.totalExpenses
    await db.monthlySnapshot.create({
      data: {
        userId: DEMO_USER_ID,
        month: monthDate,
        trueRemaining: netSurplus * 0.65,
        totalIncome: snap.totalIncome,
        totalExpenses: snap.totalExpenses,
        savingsRate: snap.savingsRate,
        netSurplus,
        annualFundedPct: 0.45 + snap.monthsBack * 0.05,
        budgetsOnTrack: randInt(8, 12),
        budgetsTotal: 14,
        fixedPaid: randInt(6, 8),
        fixedTotal: 8,
        flexOverBudget: randInt(0, 2),
        transactionCount: randInt(55, 80),
        avgDailySpend: snap.totalExpenses / 30,
        totalDebt: snap.totalDebt,
        totalDebtPayments: 2827,
        debtPaidDown: randAmount(400, 600),
        netWorth: snap.netWorth,
        personBreakdown: JSON.stringify({ Alex: Math.round(snap.totalExpenses * 0.7), Taylor: Math.round(snap.totalExpenses * 0.3) }),
        propertyBreakdown: JSON.stringify({ '456 Oak Ave': 2350, '123 Main St': 1925 }),
      },
    })
  }

  // ─── Change 6: Seed AI Insights ───────────────────────────────────
  await db.insight.createMany({
    data: [
      {
        userId: DEMO_USER_ID,
        category: 'spending',
        type: 'optimization',
        priority: 'high',
        title: 'Dining spending trending up',
        description: 'Your restaurant & bar spending has increased 18% over the last 3 months, averaging $285/mo vs your $250 budget. Consider meal-prepping 2 extra dinners per week to save ~$120/month.',
        savingsAmount: 120,
        actionItems: JSON.stringify([
          'Review dining transactions from the past 30 days',
          'Identify weekday vs weekend dining patterns',
          'Set a weekly dining budget of $55',
        ]),
        status: 'active',
        generatedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        userId: DEMO_USER_ID,
        category: 'savings',
        type: 'alert',
        priority: 'medium',
        title: 'On track for emergency fund goal',
        description: "At your current savings rate of 22%, you're projected to reach your $25K emergency fund target by February 2027 — 4 months ahead of schedule. Great progress!",
        savingsAmount: null,
        actionItems: JSON.stringify([
          'Continue current savings trajectory',
          'Consider increasing 401(k) contributions after hitting $25K',
          'Review target once the raise kicks in',
        ]),
        status: 'active',
        generatedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        userId: DEMO_USER_ID,
        category: 'subscription',
        type: 'waste',
        priority: 'low',
        title: 'Subscription creep detected',
        description: 'Your recurring subscriptions total $96.96/mo ($1,163/yr). NYT Digital ($17/mo) has the lowest engagement based on transaction frequency. Consider if all subscriptions still provide value.',
        savingsAmount: 17,
        actionItems: JSON.stringify([
          'Audit all active subscriptions',
          'Check if NYT Digital can be shared or downgraded',
          'Set a calendar reminder to review subscriptions quarterly',
        ]),
        status: 'active',
        generatedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      },
    ],
  })

  // ─── Change 7: Seed Efficiency Scores ─────────────────────────────
  const efficiencyData = [
    { monthsBack: 2, overall: 68, spending: 65, savings: 72, debt: 67 },
    { monthsBack: 1, overall: 72, spending: 69, savings: 76, debt: 71 },
    { monthsBack: 0, overall: 77, spending: 74, savings: 81, debt: 76 },
  ]

  for (const eff of efficiencyData) {
    const period = new Date(now.getFullYear(), now.getMonth() - eff.monthsBack, 1)
    const periodStr = `${period.getFullYear()}-${String(period.getMonth() + 1).padStart(2, '0')}`
    await db.efficiencyScore.create({
      data: {
        userId: DEMO_USER_ID,
        overallScore: eff.overall,
        spendingScore: eff.spending,
        savingsScore: eff.savings,
        debtScore: eff.debt,
        period: periodStr,
        breakdown: JSON.stringify({
          spending: { score: eff.spending, benchmarkPct: 0.72, topCategory: 'Dining' },
          savings: { score: eff.savings, rate: 0.22, targetRate: 0.25 },
          debt: { score: eff.debt, dtiRatio: 0.31, paydownRate: 0.04 },
        }),
      },
    })
  }
}
