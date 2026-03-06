import { db } from '@/lib/db'
import { computeForecast, autoDetectAssetClass, computeForecastAccuracy } from '@/lib/engines/forecast'
import type {
  AssetClass,
  GoalTarget,
  ForecastInput,
  MonthlySnapshotData,
  DebtForForecast,
  AccountForForecast,
  BudgetSummaryForForecast,
  AnnualExpenseForForecast,
  PropertyForForecast,
  Forecast,
  ForecastAccuracy,
} from '@/types'

// Simple in-memory cache: userId -> { forecast, timestamp }
const forecastCache = new Map<string, { forecast: Forecast; timestamp: number }>()
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

export async function getForecastSummaries(
  userId: string,
): Promise<Forecast['tabSummaries'] | null> {
  const forecast = await getCachedForecast(userId)
  return forecast?.tabSummaries ?? null
}

export async function getForecastAccuracy(userId: string): Promise<ForecastAccuracy | null> {
  const forecast = await getCachedForecast(userId)
  if (!forecast) return null
  return computeForecastAccuracy(forecast.timeline)
}

export async function getCachedForecast(userId: string): Promise<Forecast | null> {
  const cached = forecastCache.get(userId)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.forecast
  }

  const input = await buildForecastInput(userId)
  if (!input) return null

  const forecast = computeForecast(input)
  forecastCache.set(userId, { forecast, timestamp: Date.now() })
  return forecast
}

async function buildForecastInput(userId: string): Promise<ForecastInput | null> {
  const profile = await db.userProfile.findUnique({
    where: { userId },
    select: { primaryGoal: true, goalTarget: true, expectedMonthlyIncome: true },
  })

  if (!profile?.goalTarget) return null

  const goalTarget = profile.goalTarget as unknown as GoalTarget

  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

  const [snapshots, debts, accounts, budgets, annualExpenses, properties] = await Promise.all([
    db.monthlySnapshot.findMany({
      where: { userId, month: { gte: twelveMonthsAgo } },
      orderBy: { month: 'asc' },
    }),
    db.debt.findMany({ where: { userId } }),
    db.account.findMany({ where: { userId } }),
    db.budget.findMany({
      where: { userId },
      include: { category: true, annualExpense: true },
    }),
    db.annualExpense.findMany({ where: { userId } }),
    db.property.findMany({ where: { userId } }),
  ])

  const snapshotData: MonthlySnapshotData[] = snapshots.map((s) => ({
    month: s.month.toISOString(),
    totalIncome: s.totalIncome,
    totalExpenses: s.totalExpenses,
    netSurplus: s.netSurplus,
    savingsRate: s.savingsRate,
    totalDebt: s.totalDebt,
    debtPaidDown: s.debtPaidDown,
    netWorth: s.netWorth,
    trueRemaining: s.trueRemaining,
  }))

  const debtData: DebtForForecast[] = debts.map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    balance: d.currentBalance,
    interestRate: d.interestRate,
    minimumPayment: d.minimumPayment,
  }))

  const accountData: AccountForForecast[] = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    balance: a.balance,
    assetClass: (a.assetClass as AssetClass) || autoDetectAssetClass(a.type),
    expectedReturn: a.expectedReturn,
    riskWeight: a.riskWeightOverride,
  }))

  const fixedTotal = budgets.filter((b) => b.tier === 'FIXED').reduce((s, b) => s + b.amount, 0)
  const flexibleTotal = budgets.filter((b) => b.tier === 'FLEXIBLE').reduce((s, b) => s + b.amount, 0)
  const annualSetAside = budgets
    .filter((b) => b.tier === 'ANNUAL')
    .reduce((s, b) => s + (b.annualExpense?.monthlySetAside ?? 0), 0)
  const expectedMonthlyIncome = profile.expectedMonthlyIncome ?? 0
  const totalBudgeted = fixedTotal + flexibleTotal + annualSetAside

  const budgetSummary: BudgetSummaryForForecast = {
    fixedTotal,
    flexibleTotal,
    annualSetAside,
    expectedMonthlyIncome,
    totalBudgeted,
    projectedSurplus: expectedMonthlyIncome - totalBudgeted,
  }

  const annualExpenseData: AnnualExpenseForForecast[] = annualExpenses.map((ae) => ({
    id: ae.id,
    name: ae.name,
    annualAmount: ae.annualAmount,
    monthlySetAside: ae.monthlySetAside,
    funded: ae.funded,
    dueMonth: ae.dueMonth,
    dueYear: ae.dueYear,
    status: ae.status,
  }))

  const propertyData: PropertyForForecast[] = properties.map((p) => ({
    id: p.id,
    name: p.name,
    currentValue: p.currentValue ?? 0,
    loanBalance: p.loanBalance,
    interestRate: p.interestRate,
    monthlyPayment: p.monthlyPayment,
    appreciationRate: p.appreciationRate ?? 0.03,
  }))

  return {
    goal: goalTarget,
    snapshots: snapshotData,
    debts: debtData,
    accounts: accountData,
    budgets: budgetSummary,
    annualExpenses: annualExpenseData,
    properties: propertyData,
  }
}
