import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { calculateDepreciation } from '@/lib/engines/tax'

/**
 * Compute and store a MonthlySnapshot for a given user and month.
 * Uses upsert to avoid duplicates if re-run.
 */
export async function createMonthlySnapshot(userId: string, year: number, month: number) {
  const startDate = new Date(year, month - 1, 1) // month is 1-indexed
  const endDate = new Date(year, month, 0, 23, 59, 59, 999)
  const daysInMonth = new Date(year, month, 0).getDate()

  // Fetch all data needed for the snapshot
  const [
    incomeAgg,
    expenseAgg,
    txCount,
    budgets,
    budgetExpenses,
    debts,
    debtPaymentTransactions,
    personSpending,
    propertySpending,
    latestScore,
    accounts,
    propertiesForNetWorth,
  ] = await Promise.all([
    // Exclude transfers from income/expense totals in snapshots
    db.transaction.aggregate({
      where: { userId, date: { gte: startDate, lte: endDate }, classification: 'income' },
      _sum: { amount: true },
    }),
    db.transaction.aggregate({
      where: { userId, date: { gte: startDate, lte: endDate }, classification: 'expense' },
      _sum: { amount: true },
    }),
    db.transaction.count({
      where: { userId, date: { gte: startDate, lte: endDate } },
    }),
    db.budget.findMany({
      where: { userId },
      include: { annualExpense: true },
    }),
    db.transaction.findMany({
      where: { userId, date: { gte: startDate, lte: endDate }, classification: 'expense', amount: { lt: 0 } },
      select: { categoryId: true, amount: true },
    }),
    db.debt.findMany({ where: { userId } }),
    // Debt payment transactions (negative amounts to debt-related categories)
    db.transaction.findMany({
      where: {
        userId,
        date: { gte: startDate, lte: endDate },
        amount: { lt: 0 },
        category: { isTaxRelevant: true },
      },
      select: { amount: true },
    }),
    // Spending by person (exclude transfers)
    db.transaction.groupBy({
      by: ['householdMemberId'],
      where: { userId, date: { gte: startDate, lte: endDate }, classification: 'expense', amount: { lt: 0 }, householdMemberId: { not: null } },
      _sum: { amount: true },
    }),
    // Spending by property (exclude transfers)
    db.transaction.groupBy({
      by: ['propertyId'],
      where: { userId, date: { gte: startDate, lte: endDate }, classification: 'expense', amount: { lt: 0 }, propertyId: { not: null } },
      _sum: { amount: true },
    }),
    db.efficiencyScore.findFirst({
      where: { userId, period: `${year}-${String(month).padStart(2, '0')}` },
    }),
    // Account balances for net worth calculation (R7.9)
    db.account.findMany({
      where: { userId },
      select: { type: true, balance: true },
    }),
    // Property values for net worth calculation
    db.property.findMany({
      where: { userId },
      select: { currentValue: true, loanBalance: true },
    }),
  ])

  const totalIncome = incomeAgg._sum.amount ?? 0
  const totalExpenses = Math.abs(expenseAgg._sum.amount ?? 0)
  const netSurplus = totalIncome - totalExpenses
  const savingsRate = totalIncome > 0 ? netSurplus / totalIncome : 0

  // Budget computations
  const spentByCategory = new Map<string, number>()
  for (const tx of budgetExpenses) {
    if (tx.categoryId) {
      spentByCategory.set(tx.categoryId, (spentByCategory.get(tx.categoryId) ?? 0) + Math.abs(tx.amount))
    }
  }

  const fixedBudgets = budgets.filter((b) => b.tier === 'FIXED')
  const flexBudgets = budgets.filter((b) => b.tier === 'FLEXIBLE')
  const annualBudgets = budgets.filter((b) => b.tier === 'ANNUAL')

  const fixedTotal = fixedBudgets.length
  const fixedPaid = fixedBudgets.filter((b) => {
    const spent = b.categoryId ? (spentByCategory.get(b.categoryId) ?? 0) : 0
    return spent > 0
  }).length

  const flexOverBudget = flexBudgets.filter((b) => {
    const spent = b.categoryId ? (spentByCategory.get(b.categoryId) ?? 0) : 0
    return spent > b.amount
  }).length

  const budgetsOnTrack = flexBudgets.filter((b) => {
    const spent = b.categoryId ? (spentByCategory.get(b.categoryId) ?? 0) : 0
    return spent <= b.amount
  }).length

  const fixedCommitted = fixedBudgets.reduce((s, b) => s + b.amount, 0)
  const flexSpent = flexBudgets.reduce((s, b) => s + (b.categoryId ? (spentByCategory.get(b.categoryId) ?? 0) : 0), 0)
  const annualSetAside = annualBudgets.reduce((s, b) => s + (b.annualExpense?.monthlySetAside ?? 0), 0)
  const trueRemaining = totalIncome - fixedCommitted - flexSpent - annualSetAside

  // Annual funded percentage
  const totalAnnualAmount = annualBudgets.reduce((s, b) => s + (b.annualExpense?.annualAmount ?? 0), 0)
  const totalAnnualFunded = annualBudgets.reduce((s, b) => s + (b.annualExpense?.funded ?? 0), 0)
  const annualFundedPct = totalAnnualAmount > 0 ? totalAnnualFunded / totalAnnualAmount : 0

  const avgDailySpend = totalExpenses / daysInMonth

  // Debt summary
  const totalDebt = debts.reduce((s, d) => s + d.currentBalance, 0)
  const totalDebtPayments = debts.reduce((s, d) => s + d.minimumPayment, 0)

  // Compute debt paid down this month (compare to previous month's snapshot)
  let debtPaidDown: number | null = null
  if (debts.length > 0) {
    const prevMonth = new Date(year, month - 2, 1)
    const prevSnapshot = await db.monthlySnapshot.findUnique({
      where: { userId_month: { userId, month: prevMonth } },
      select: { totalDebt: true },
    })
    if (prevSnapshot?.totalDebt != null) {
      // Positive = debt went down (good), negative = debt went up
      debtPaidDown = prevSnapshot.totalDebt - totalDebt
    }
  }

  // Net worth: assets minus liabilities plus property equity (R7.9)
  const LIABILITY_TYPES = new Set(['CREDIT_CARD', 'MORTGAGE', 'AUTO_LOAN', 'STUDENT_LOAN'])
  const accountNetWorth = accounts.reduce((sum, a) => {
    if (LIABILITY_TYPES.has(a.type)) return sum - Math.abs(a.balance)
    return sum + a.balance
  }, 0)

  // Property equity: add property values, subtract loan balances not already
  // tracked as Plaid mortgage accounts (to avoid double-counting)
  const mortgageAccountBalances = accounts
    .filter(a => a.type === 'MORTGAGE')
    .reduce((sum, a) => sum + Math.abs(a.balance), 0)
  const totalPropertyValue = propertiesForNetWorth.reduce(
    (sum, p) => sum + (p.currentValue ?? 0), 0
  )
  const totalPropertyLoans = propertiesForNetWorth.reduce(
    (sum, p) => sum + (p.loanBalance ?? 0), 0
  )
  // If mortgage accounts exist in Plaid, they're already subtracted from accountNetWorth.
  // Only subtract property loan balances that aren't covered by Plaid mortgage accounts.
  const uncoveredLoans = Math.max(0, totalPropertyLoans - mortgageAccountBalances)
  const propertyEquity = totalPropertyValue - uncoveredLoans
  const netWorth = accountNetWorth + propertyEquity

  // Person breakdown
  let personBreakdown: string | null = null
  if (personSpending.length > 0) {
    const memberIds = personSpending.map((p) => p.householdMemberId).filter((id): id is string => id !== null)
    const members = await db.householdMember.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, name: true },
    })
    const nameMap = new Map(members.map((m) => [m.id, m.name]))
    const breakdown: Record<string, number> = {}
    for (const p of personSpending) {
      if (p.householdMemberId) {
        breakdown[nameMap.get(p.householdMemberId) ?? 'Unknown'] = Math.abs(p._sum.amount ?? 0)
      }
    }
    personBreakdown = JSON.stringify(breakdown)
  }

  // Enhanced property breakdown with income, expenses, depreciation, net
  let propertyBreakdown: string | null = null
  const userProperties = await db.property.findMany({
    where: { userId },
    select: {
      id: true, name: true, type: true,
      purchasePrice: true, purchaseDate: true,
      buildingValuePct: true, priorDepreciation: true,
    },
  })

  if (userProperties.length > 0) {
    // Get all property transactions this month (income + expenses)
    const propertyTransactions = await db.transaction.findMany({
      where: {
        userId,
        date: { gte: startDate, lte: endDate },
        propertyId: { not: null },
      },
      select: { propertyId: true, amount: true, classification: true },
    })

    // Get split allocations this month
    const splitAllocations = await db.transactionSplit.findMany({
      where: {
        transaction: { userId, date: { gte: startDate, lte: endDate } },
      },
      select: {
        propertyId: true, amount: true,
        transaction: { select: { classification: true } },
      },
    })

    const propEntries: Array<{
      id: string; name: string; type: string
      income: number; expenses: number; depreciation: number; netIncome: number
      splitTransactions: number; directTransactions: number
    }> = []

    for (const prop of userProperties) {
      const directTxs = propertyTransactions.filter((t) => t.propertyId === prop.id)
      const propSplits = splitAllocations.filter((s) => s.propertyId === prop.id)

      let income = 0
      let expenses = 0
      for (const tx of directTxs) {
        if (tx.classification === 'income' || tx.amount > 0) income += Math.abs(tx.amount)
        else expenses += Math.abs(tx.amount)
      }
      for (const s of propSplits) {
        if (s.transaction.classification === 'income' || s.amount > 0) income += Math.abs(s.amount)
        else expenses += Math.abs(s.amount)
      }

      if (income === 0 && expenses === 0 && prop.type === 'PERSONAL') continue

      let depreciation = 0
      if (prop.type === 'RENTAL' && prop.purchasePrice && prop.purchaseDate) {
        const depResult = calculateDepreciation({
          purchasePrice: Number(prop.purchasePrice),
          purchaseDate: prop.purchaseDate,
          buildingValuePct: Number(prop.buildingValuePct ?? 80),
          priorDepreciation: Number(prop.priorDepreciation ?? 0),
          asOfDate: endDate,
        })
        depreciation = depResult.monthlyDepreciation
      }

      propEntries.push({
        id: prop.id,
        name: prop.name,
        type: prop.type,
        income: Math.round(income * 100) / 100,
        expenses: Math.round(expenses * 100) / 100,
        depreciation: Math.round(depreciation * 100) / 100,
        netIncome: Math.round((income - expenses - depreciation) * 100) / 100,
        splitTransactions: propSplits.length,
        directTransactions: directTxs.length,
      })
    }

    if (propEntries.length > 0) {
      const totalRentalNet = propEntries
        .filter((p) => p.type === 'RENTAL')
        .reduce((s, p) => s + p.netIncome, 0)
      const totalBusinessNet = propEntries
        .filter((p) => p.type === 'BUSINESS')
        .reduce((s, p) => s + p.netIncome, 0)
      const totalDepr = propEntries.reduce((s, p) => s + p.depreciation, 0)

      propertyBreakdown = JSON.stringify({
        properties: propEntries,
        totalRentalNet: Math.round(totalRentalNet * 100) / 100,
        totalBusinessNet: Math.round(totalBusinessNet * 100) / 100,
        totalDepreciation: Math.round(totalDepr * 100) / 100,
      })
    }
  }

  // Balance history: sum account balances by type bucket
  const CASH_TYPES = new Set(['CHECKING', 'SAVINGS', 'CASH'])
  const INVESTMENT_TYPES = new Set(['INVESTMENT'])
  const cashBalance = accounts.filter(a => CASH_TYPES.has(a.type)).reduce((s, a) => s + a.balance, 0)
  const investmentBalance = accounts.filter(a => INVESTMENT_TYPES.has(a.type)).reduce((s, a) => s + a.balance, 0)
  const debtBalance = accounts.filter(a => LIABILITY_TYPES.has(a.type)).reduce((s, a) => s + Math.abs(a.balance), 0)
    + debts.filter(d => !accounts.some(a => a.type === d.type)).reduce((s, d) => s + d.currentBalance, 0)
  const balanceHistory: Prisma.InputJsonValue | typeof Prisma.JsonNull = accounts.length > 0
    ? { cash: Math.round(cashBalance * 100) / 100, investments: Math.round(investmentBalance * 100) / 100, debt: Math.round(debtBalance * 100) / 100 }
    : Prisma.JsonNull

  // Category breakdown: merge budgets with actual spending
  const categories = await db.category.findMany({
    where: { OR: [{ userId }, { userId: null, isDefault: true }] },
    select: { id: true, name: true, group: true },
  })
  const categoryMap = new Map(categories.map(c => [c.id, c]))
  const categoryBreakdownItems: Array<{ categoryName: string; group: string; budgeted: number; spent: number }> = []
  for (const b of [...fixedBudgets, ...flexBudgets]) {
    if (!b.categoryId) continue
    const cat = categoryMap.get(b.categoryId)
    if (!cat) continue
    const spent = spentByCategory.get(b.categoryId) ?? 0
    categoryBreakdownItems.push({
      categoryName: cat.name,
      group: cat.group,
      budgeted: Math.round(b.amount * 100) / 100,
      spent: Math.round(spent * 100) / 100,
    })
  }
  const categoryBreakdown: Prisma.InputJsonValue | typeof Prisma.JsonNull = categoryBreakdownItems.length > 0 ? categoryBreakdownItems as unknown as Prisma.InputJsonValue : Prisma.JsonNull

  const snapshotMonth = new Date(year, month - 1, 1)

  await db.monthlySnapshot.upsert({
    where: { userId_month: { userId, month: snapshotMonth } },
    create: {
      userId,
      month: snapshotMonth,
      trueRemaining,
      totalIncome,
      totalExpenses,
      savingsRate,
      netSurplus,
      annualFundedPct,
      budgetsOnTrack,
      budgetsTotal: flexBudgets.length,
      fixedPaid,
      fixedTotal,
      flexOverBudget,
      transactionCount: txCount,
      avgDailySpend,
      totalDebt: debts.length > 0 ? totalDebt : null,
      totalDebtPayments: debts.length > 0 ? totalDebtPayments : null,
      debtPaidDown,
      netWorth: accounts.length > 0 || propertiesForNetWorth.length > 0 ? netWorth : null,
      propertyEquity: propertiesForNetWorth.length > 0 ? propertyEquity : null,
      personBreakdown,
      propertyBreakdown,
      efficiencyScore: latestScore ? Math.round(latestScore.overallScore) : null,
      spendingScore: latestScore ? Math.round(latestScore.spendingScore) : null,
      savingsScore: latestScore ? Math.round(latestScore.savingsScore) : null,
      debtScore: latestScore ? Math.round(latestScore.debtScore) : null,
      balanceHistory,
      categoryBreakdown,
    },
    update: {
      trueRemaining,
      totalIncome,
      totalExpenses,
      savingsRate,
      netSurplus,
      annualFundedPct,
      budgetsOnTrack,
      budgetsTotal: flexBudgets.length,
      fixedPaid,
      fixedTotal,
      flexOverBudget,
      transactionCount: txCount,
      avgDailySpend,
      totalDebt: debts.length > 0 ? totalDebt : null,
      totalDebtPayments: debts.length > 0 ? totalDebtPayments : null,
      debtPaidDown,
      netWorth: accounts.length > 0 || propertiesForNetWorth.length > 0 ? netWorth : null,
      propertyEquity: propertiesForNetWorth.length > 0 ? propertyEquity : null,
      personBreakdown,
      propertyBreakdown,
      efficiencyScore: latestScore ? Math.round(latestScore.overallScore) : null,
      spendingScore: latestScore ? Math.round(latestScore.spendingScore) : null,
      savingsScore: latestScore ? Math.round(latestScore.savingsScore) : null,
      debtScore: latestScore ? Math.round(latestScore.debtScore) : null,
      balanceHistory,
      categoryBreakdown,
    },
  })
}
