/**
 * Demo data seed logic — importable by both the standalone seed script
 * and the cron reset API route.
 */
import type { PrismaClient } from '@prisma/client'
import { AccountType, BudgetPeriod, BudgetTier } from '@prisma/client'
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

  // ─── Profile: Dr. Alex Kim — resident physician ────────────────────
  const passwordHash = await hashPassword('demo1234')
  await db.user.create({
    data: {
      id: DEMO_USER_ID,
      email: DEMO_USER_EMAIL,
      name: 'Dr. Alex Kim',
      password: passwordHash,
      profile: {
        create: {
          onboardingCompleted: true,
          onboardingCompletedAt: new Date(),
          onboardingStep: 3,
          primaryGoal: 'pay_off_debt',
          householdType: 'single',
          incomeRange: '50k_75k',
          expectedMonthlyIncome: 5417,
          goalSetAt: new Date(),
          goalTarget: {
            archetype: 'pay_off_debt',
            metric: 'total_debt',
            targetValue: 0,
            targetDate: '2033-06-01',
            startValue: 267000,
            startDate: new Date().toISOString().slice(0, 10),
            label: 'Pay off all debt',
          },
          incomeTransitions: [
            {
              id: 'it_demo_attending',
              date: '2028-07-01',
              monthlyIncome: 22500,
              label: 'Attending physician salary',
              annualIncome: 270000,
            },
          ],
        },
      },
    },
  })

  // ─── Household member: Alex only ─────────────────────────────────────
  const alex = await db.householdMember.create({
    data: { userId: DEMO_USER_ID, name: 'Alex', isDefault: true },
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

  // ─── Accounts ─────────────────────────────────────────────────────────
  const checking = await db.account.create({
    data: { userId: DEMO_USER_ID, name: 'Checking', type: AccountType.CHECKING, balance: 2800 },
  })
  const savings = await db.account.create({
    data: { userId: DEMO_USER_ID, name: 'Savings', type: AccountType.SAVINGS, balance: 3200 },
  })
  const creditCard = await db.account.create({
    data: { userId: DEMO_USER_ID, name: 'Credit Card', type: AccountType.CREDIT_CARD, balance: 0 },
  })
  const studentLoanAcct = await db.account.create({
    data: {
      userId: DEMO_USER_ID,
      name: 'Student Loans',
      type: AccountType.STUDENT_LOAN,
      balance: -258000,
    },
  })
  const rothIRA = await db.account.create({
    data: { userId: DEMO_USER_ID, name: 'Roth IRA', type: AccountType.INVESTMENT, balance: 8500 },
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

  // ─── Recurring transactions (6 months) ──────────────────────────────
  for (let m = 5; m >= 0; m--) {
    // Income — bi-weekly paycheck (resident salary ~$65K/yr)
    addTx(checking.id, 'Paychecks', 2708, 'University Hospital — Payroll', monthsAgo(m, 1))
    addTx(checking.id, 'Paychecks', 2708, 'University Hospital — Payroll', monthsAgo(m, 15))

    // Moonlighting shifts (~30% of months)
    if (Math.random() < 0.3) {
      addTx(checking.id, 'Side Gig', randAmount(1200, 1500), 'Moonlighting — ER Coverage', monthsAgo(m, randInt(15, 20)))
    }

    // Fixed expenses
    addTx(checking.id, 'Rent', -1800, 'Parkside Apartments', monthsAgo(m, 1))
    addTx(checking.id, 'Insurance', -120, 'State Farm', monthsAgo(m, 3))
    addTx(checking.id, 'Gas & Electric', -randAmount(70, 110), 'National Grid', monthsAgo(m, randInt(18, 22)))
    addTx(checking.id, 'Internet & Cable', -69.99, 'Verizon Fios', monthsAgo(m, 8))

    // Subscriptions
    addTx(creditCard.id, 'Subscriptions', -15.99, 'Netflix', monthsAgo(m, 4))
    addTx(creditCard.id, 'Subscriptions', -10.99, 'Spotify Family', monthsAgo(m, 4))
    addTx(creditCard.id, 'Subscriptions', -24.99, 'UpToDate', monthsAgo(m, 3))

    // Student loan payment
    addTx(checking.id, 'Loan Payment', -800, 'FedLoan Servicing', monthsAgo(m, 20))

    // Groceries (6-8 per month — less time to cook)
    const groceryMerchants = ["Trader Joe's", 'Stop & Shop', 'Whole Foods', 'Aldi', 'Costco']
    const groceryCount = randInt(6, 8)
    for (let i = 0; i < groceryCount; i++) {
      addTx(
        pick([checking.id, creditCard.id]),
        'Groceries',
        -randAmount(20, 80),
        pick(groceryMerchants),
        monthsAgo(m, randInt(1, 28))
      )
    }

    // Dining (6-10 per month — hospital cafeteria, fast casual)
    const diningMerchants = ['Hospital Cafeteria', 'Chipotle', "McDonald's", 'Starbucks', 'Subway', 'Panera Bread']
    const diningCount = randInt(6, 10)
    for (let i = 0; i < diningCount; i++) {
      addTx(
        pick([checking.id, creditCard.id]),
        'Restaurants & Bars',
        -randAmount(8, 35),
        pick(diningMerchants),
        monthsAgo(m, randInt(1, 28))
      )
    }

    // Gas (2-3 per month)
    const gasCount = randInt(2, 3)
    for (let i = 0; i < gasCount; i++) {
      addTx(
        creditCard.id, 'Gas', -randAmount(30, 45),
        pick(['Shell', 'Sunoco', 'Mobil']),
        monthsAgo(m, randInt(1, 28))
      )
    }

    // Entertainment (1-2 per month)
    const entertainmentMerchants = ['AMC Theatres', 'Steam', 'Barnes & Noble', 'Ticketmaster']
    const entertainCount = randInt(1, 2)
    for (let i = 0; i < entertainCount; i++) {
      addTx(
        creditCard.id,
        'Entertainment & Recreation',
        -randAmount(8, 30),
        pick(entertainmentMerchants),
        monthsAgo(m, randInt(1, 28))
      )
    }

    // Clothing (every other month only)
    if (m % 2 === 0) {
      addTx(creditCard.id, 'Clothing', -randAmount(20, 50), pick(['Target', 'Uniqlo', 'H&M', 'Amazon']), monthsAgo(m, randInt(5, 25)))
    }

    // Personal Care (1-2 per month)
    const pcCount = randInt(1, 2)
    for (let i = 0; i < pcCount; i++) {
      addTx(creditCard.id, 'Personal Care', -randAmount(15, 45), pick(['CVS', 'Great Clips', 'Walgreens']), monthsAgo(m, randInt(3, 27)))
    }

    // Medical expenses (board prep, some months)
    if (randInt(0, 2) === 0) {
      addTx(creditCard.id, 'Medical', -randAmount(20, 50), 'Board Prep Materials', monthsAgo(m, randInt(10, 20)))
    }
  }

  // Recent transactions (last few days)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const twoDaysAgo = new Date(today)
  twoDaysAgo.setDate(today.getDate() - 2)

  addTx(creditCard.id, 'Groceries', -67.42, "Trader Joe's", twoDaysAgo)
  addTx(creditCard.id, 'Restaurants & Bars', -12.50, 'Hospital Cafeteria', yesterday)
  addTx(checking.id, 'Gas', -38.18, 'Shell', yesterday)

  // ─── Current month guaranteed transactions ──────────────────────────
  addTx(checking.id, 'Paychecks', 2708, 'University Hospital — Payroll', monthsAgo(0, 1))
  addTx(checking.id, 'Paychecks', 2708, 'University Hospital — Payroll', monthsAgo(0, 15))

  addTx(checking.id, 'Rent', -1800, 'Parkside Apartments', monthsAgo(0, 1))
  addTx(checking.id, 'Gas & Electric', -90, 'National Grid', monthsAgo(0, 5))
  addTx(checking.id, 'Insurance', -120, 'State Farm', monthsAgo(0, 3))
  addTx(creditCard.id, 'Internet & Cable', -69.99, 'Verizon Fios', monthsAgo(0, 7))
  addTx(creditCard.id, 'Subscriptions', -15.99, 'Netflix', monthsAgo(0, 4))
  addTx(creditCard.id, 'Subscriptions', -10.99, 'Spotify Family', monthsAgo(0, 4))
  addTx(creditCard.id, 'Subscriptions', -24.99, 'UpToDate', monthsAgo(0, 12))

  addTx(creditCard.id, 'Groceries', -48.33, 'Whole Foods', monthsAgo(0, 2))
  addTx(creditCard.id, 'Groceries', -32.17, "Trader Joe's", monthsAgo(0, 5))
  addTx(creditCard.id, 'Restaurants & Bars', -14.50, 'Chipotle', monthsAgo(0, 3))
  addTx(creditCard.id, 'Gas', -38.20, 'Shell', monthsAgo(0, 1))
  addTx(creditCard.id, 'Restaurants & Bars', -6.75, 'Starbucks', monthsAgo(0, 2))
  addTx(creditCard.id, 'Restaurants & Bars', -5.50, 'Hospital Cafeteria', monthsAgo(0, 5))
  addTx(checking.id, 'Loan Payment', -800, 'FedLoan Servicing', monthsAgo(0, 20))

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
    { name: 'Rent', category: 'Rent', amount: 1800, dueDay: 1, isAutoPay: true, varianceLimit: 0 },
    { name: 'Insurance', category: 'Insurance', amount: 120, dueDay: 3, isAutoPay: true, varianceLimit: 5 },
    { name: 'Electric', category: 'Gas & Electric', amount: 90, dueDay: 20, isAutoPay: false, varianceLimit: 30 },
    { name: 'Internet', category: 'Internet & Cable', amount: 69.99, dueDay: 8, isAutoPay: true, varianceLimit: 0 },
    { name: 'Subscriptions', category: 'Subscriptions', amount: 53, dueDay: 3, isAutoPay: true, varianceLimit: 2 },
    { name: 'Student Loan', category: 'Loan Payment', amount: 800, dueDay: 20, isAutoPay: true, varianceLimit: 0 },
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
    { name: 'Groceries', category: 'Groceries', amount: 400 },
    { name: 'Dining Out', category: 'Restaurants & Bars', amount: 200 },
    { name: 'Gas', category: 'Gas', amount: 120 },
    { name: 'Entertainment', category: 'Entertainment & Recreation', amount: 60 },
    { name: 'Clothing', category: 'Clothing', amount: 50 },
    { name: 'Personal Care', category: 'Personal Care', amount: 40 },
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

  // ─── Annual Expenses ─────────────────────────────────────────────────
  const annualBudgetDefs = [
    {
      budgetName: 'Vacation Fund', category: 'Travel & Vacation', monthlyAmount: 100,
      expenseName: 'Vacation Fund', annualAmount: 1200, dueMonth: 7, funded: 300, status: 'planned' as const,
    },
    {
      budgetName: 'Holiday Gifts', category: 'Gifts', monthlyAmount: 34,
      expenseName: 'Holiday Gifts', annualAmount: 400, dueMonth: 12, funded: 100, status: 'planned' as const,
    },
    {
      budgetName: 'Board Exam Fees', category: 'Medical', monthlyAmount: 167,
      expenseName: 'Board Exam Fees', annualAmount: 2000, dueMonth: 5, funded: 500, status: 'planned' as const,
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

  // ─── Debts ───────────────────────────────────────────────────────────
  const loanPaymentCatId = categoryMap.get('Loan Payment')

  await db.debt.create({
    data: {
      userId: DEMO_USER_ID,
      name: 'Chase Sapphire',
      type: 'CREDIT_CARD',
      currentBalance: 2100,
      interestRate: 0.2199,
      minimumPayment: 63,
      paymentDay: 15,
      accountId: creditCard.id,
    },
  })

  await db.debt.create({
    data: {
      userId: DEMO_USER_ID,
      name: 'Federal Student Loans',
      type: 'STUDENT_LOAN',
      currentBalance: 258000,
      originalBalance: 267000,
      interestRate: 0.065,
      minimumPayment: 800,
      paymentDay: 20,
      termMonths: 120,
      startDate: new Date('2020-09-01'),
      accountId: studentLoanAcct.id,
      categoryId: loanPaymentCatId ?? null,
    },
  })

  // ─── Monthly Snapshots (6 months) ──────────────────────────────────
  const snapshotData = [
    { monthsBack: 5, totalIncome: 5416, totalExpenses: 4500, netWorth: -249800, totalDebt: 261000, savingsRate: 0.08 },
    { monthsBack: 4, totalIncome: 5416, totalExpenses: 4600, netWorth: -249200, totalDebt: 260200, savingsRate: 0.07 },
    { monthsBack: 3, totalIncome: 6800, totalExpenses: 4400, netWorth: -247000, totalDebt: 259400, savingsRate: 0.15 },
    { monthsBack: 2, totalIncome: 5416, totalExpenses: 4300, netWorth: -246000, totalDebt: 258600, savingsRate: 0.10 },
    { monthsBack: 1, totalIncome: 5416, totalExpenses: 4800, netWorth: -245600, totalDebt: 258000, savingsRate: 0.05 },
    { monthsBack: 0, totalIncome: 5416, totalExpenses: 4200, netWorth: -244400, totalDebt: 257200, savingsRate: 0.12 },
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
        budgetsOnTrack: randInt(6, 10),
        budgetsTotal: 12,
        fixedPaid: randInt(4, 6),
        fixedTotal: 6,
        flexOverBudget: randInt(0, 2),
        transactionCount: randInt(35, 55),
        avgDailySpend: snap.totalExpenses / 30,
        totalDebt: snap.totalDebt,
        totalDebtPayments: 863,
        debtPaidDown: randAmount(400, 600),
        netWorth: snap.netWorth,
        personBreakdown: JSON.stringify({ Alex: snap.totalExpenses }),
      },
    })
  }

  // ─── AI Insights ────────────────────────────────────────────────────
  await db.insight.createMany({
    data: [
      {
        userId: DEMO_USER_ID,
        category: 'debt',
        type: 'optimization',
        priority: 'high',
        title: 'Student loan payoff acceleration',
        description: 'Your student loan interest costs $1,398/mo. Once your attending salary starts in Jul 2028, directing 15% of your raise to loans pays them off 12 years early.',
        savingsAmount: 1398,
        actionItems: JSON.stringify([
          'Set a calendar reminder for Jul 2028 to increase loan payments',
          'Research income-driven repayment vs standard plan',
          'Consider refinancing once attending salary begins',
        ]),
        status: 'active',
        generatedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        userId: DEMO_USER_ID,
        category: 'savings',
        type: 'alert',
        priority: 'medium',
        title: 'Strong savings habits for a resident',
        description: "You're doing well on a resident salary — your savings rate of 10% puts you ahead of most PGY-2 residents. Focus on building habits now.",
        savingsAmount: null,
        actionItems: JSON.stringify([
          'Continue current savings trajectory',
          'Max out Roth IRA contributions while in a low tax bracket',
          'Build emergency fund to 3 months of expenses',
        ]),
        status: 'active',
        generatedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        userId: DEMO_USER_ID,
        category: 'spending',
        type: 'optimization',
        priority: 'low',
        title: 'Stealth wealth strategy',
        description: "Consider keeping your residency-level spending for 2 years after becoming an attending. This 'stealth wealth' period could eliminate your loans entirely.",
        savingsAmount: null,
        actionItems: JSON.stringify([
          'Document current monthly spending as your baseline',
          'Plan to live on resident salary for 2 years post-residency',
          'Direct the entire salary increase to debt payoff',
        ]),
        status: 'active',
        generatedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      },
    ],
  })

  // ─── Efficiency Scores ──────────────────────────────────────────────
  const efficiencyData = [
    { monthsBack: 2, overall: 52, spending: 58, savings: 42, debt: 56 },
    { monthsBack: 1, overall: 55, spending: 60, savings: 45, debt: 60 },
    { monthsBack: 0, overall: 59, spending: 63, savings: 48, debt: 66 },
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
          savings: { score: eff.savings, rate: 0.10, targetRate: 0.15 },
          debt: { score: eff.debt, dtiRatio: 0.55, paydownRate: 0.02 },
        }),
      },
    })
  }
}
