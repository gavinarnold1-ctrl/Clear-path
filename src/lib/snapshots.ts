import { db } from '@/lib/db'

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
  ] = await Promise.all([
    // R1.7: Exclude transfers from income/expense totals in snapshots
    db.transaction.aggregate({
      where: { userId, date: { gte: startDate, lte: endDate }, amount: { gt: 0 }, classification: { not: 'transfer' } },
      _sum: { amount: true },
    }),
    db.transaction.aggregate({
      where: { userId, date: { gte: startDate, lte: endDate }, amount: { lt: 0 }, classification: { not: 'transfer' } },
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
      where: { userId, date: { gte: startDate, lte: endDate }, amount: { lt: 0 }, classification: { not: 'transfer' } },
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
    // Spending by person
    db.transaction.groupBy({
      by: ['householdMemberId'],
      where: { userId, date: { gte: startDate, lte: endDate }, amount: { lt: 0 }, householdMemberId: { not: null } },
      _sum: { amount: true },
    }),
    // Spending by property
    db.transaction.groupBy({
      by: ['propertyId'],
      where: { userId, date: { gte: startDate, lte: endDate }, amount: { lt: 0 }, propertyId: { not: null } },
      _sum: { amount: true },
    }),
    db.efficiencyScore.findFirst({
      where: { userId, period: `${year}-${String(month).padStart(2, '0')}` },
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

  // Property breakdown
  let propertyBreakdown: string | null = null
  if (propertySpending.length > 0) {
    const propIds = propertySpending.map((p) => p.propertyId).filter((id): id is string => id !== null)
    const props = await db.property.findMany({
      where: { id: { in: propIds } },
      select: { id: true, name: true },
    })
    const nameMap = new Map(props.map((p) => [p.id, p.name]))
    const breakdown: Record<string, number> = {}
    for (const p of propertySpending) {
      if (p.propertyId) {
        breakdown[nameMap.get(p.propertyId) ?? 'Unknown'] = Math.abs(p._sum.amount ?? 0)
      }
    }
    propertyBreakdown = JSON.stringify(breakdown)
  }

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
      personBreakdown,
      propertyBreakdown,
      efficiencyScore: latestScore ? Math.round(latestScore.overallScore) : null,
      spendingScore: latestScore ? Math.round(latestScore.spendingScore) : null,
      savingsScore: latestScore ? Math.round(latestScore.savingsScore) : null,
      debtScore: latestScore ? Math.round(latestScore.debtScore) : null,
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
      personBreakdown,
      propertyBreakdown,
      efficiencyScore: latestScore ? Math.round(latestScore.overallScore) : null,
      spendingScore: latestScore ? Math.round(latestScore.spendingScore) : null,
      savingsScore: latestScore ? Math.round(latestScore.savingsScore) : null,
      debtScore: latestScore ? Math.round(latestScore.debtScore) : null,
    },
  })
}
