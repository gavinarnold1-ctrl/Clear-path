import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { computeForecast, autoDetectAssetClass, computeScenarioImpact, computeForecastAccuracy } from '@/lib/engines/forecast'
import { monthlyPayment } from '@/lib/engines/amortization'
import type {
  AssetClass,
  GoalTarget,
  IncomeTransition,
  ForecastInput,
  MonthlySnapshotData,
  DebtForForecast,
  AccountForForecast,
  BudgetSummaryForForecast,
  AnnualExpenseForForecast,
  PropertyForForecast,
} from '@/types'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const input = await buildForecastInput(session.userId)
  if (!input) {
    return NextResponse.json({ forecast: null, reason: 'no_goal_target' })
  }

  const forecast = computeForecast(input)
  const accuracy = computeForecastAccuracy(forecast.timeline)
  return NextResponse.json({ forecast, accuracy })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { scenarioType, params } = await req.json()
  if (!scenarioType) {
    return NextResponse.json({ error: 'scenarioType is required' }, { status: 400 })
  }

  const input = await buildForecastInput(session.userId)
  if (!input) {
    return NextResponse.json({ error: 'No goal target set' }, { status: 400 })
  }

  const baseline = computeForecast(input)

  // Build modified input based on scenario type
  const modifiedInput = applyScenario(input, scenarioType, params)
  const impact = computeScenarioImpact(baseline, modifiedInput)

  const scenario = {
    id: `custom-${scenarioType}`,
    label: params?.label ?? `Custom ${scenarioType}`,
    description: params?.description ?? '',
    type: scenarioType,
    impact,
  }

  return NextResponse.json({ scenario })
}

async function buildForecastInput(userId: string): Promise<ForecastInput | null> {
  const profile = await db.userProfile.findUnique({
    where: { userId },
    select: { primaryGoal: true, goalTarget: true, expectedMonthlyIncome: true, incomeTransitions: true },
  })

  if (!profile?.goalTarget) return null

  const goalTarget = profile.goalTarget as unknown as GoalTarget

  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

  const [snapshots, debts, accounts, budgets, annualExpenses, properties] = await Promise.all([
    db.monthlySnapshot.findMany({
      where: { userId, month: { gte: twelveMonthsAgo } },
      orderBy: { month: 'asc' },
    }),
    db.debt.findMany({
      where: { userId },
      include: { account: true },
    }),
    db.account.findMany({
      where: { userId },
    }),
    db.budget.findMany({
      where: { userId },
      include: { category: true, annualExpense: true },
    }),
    db.annualExpense.findMany({
      where: { userId },
    }),
    db.property.findMany({
      where: { userId },
    }),
  ])

  // Compute actual avg payment for debts from last 3 months of transactions
  const debtIds = debts.map((d) => d.id)
  const debtPayments = debtIds.length > 0
    ? await db.transaction.groupBy({
        by: ['debtId'],
        where: {
          userId,
          debtId: { in: debtIds },
          date: { gte: threeMonthsAgo },
          amount: { lt: 0 },
        },
        _sum: { amount: true },
        _count: true,
      })
    : []

  const debtPaymentMap = new Map(
    debtPayments.map((dp) => [dp.debtId, Math.abs(dp._sum.amount ?? 0) / Math.max(1, dp._count / 1)]),
  )

  // Map snapshots
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

  // Map debts
  const debtData: DebtForForecast[] = debts.map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    balance: d.currentBalance,
    interestRate: d.interestRate,
    minimumPayment: d.minimumPayment,
    actualAvgPayment: debtPaymentMap.get(d.id),
  }))

  // Map accounts
  const accountData: AccountForForecast[] = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    balance: a.balance,
    assetClass: (a.assetClass as AssetClass) || autoDetectAssetClass(a.type),
    expectedReturn: a.expectedReturn,
    riskWeight: a.riskWeightOverride,
  }))

  // Compute budget summary
  const fixedTotal = budgets.filter((b) => b.tier === 'FIXED').reduce((s, b) => s + b.amount, 0)
  const flexibleTotal = budgets.filter((b) => b.tier === 'FLEXIBLE').reduce((s, b) => s + b.amount, 0)
  const annualSetAside = budgets
    .filter((b) => b.tier === 'ANNUAL')
    .reduce((s, b) => s + (b.annualExpense?.monthlySetAside ?? 0), 0)
  const expectedMonthlyIncome = profile.expectedMonthlyIncome ?? 0
  const totalBudgeted = fixedTotal + flexibleTotal + annualSetAside
  const projectedSurplus = expectedMonthlyIncome - totalBudgeted

  const budgetSummary: BudgetSummaryForForecast = {
    fixedTotal,
    flexibleTotal,
    annualSetAside,
    expectedMonthlyIncome,
    totalBudgeted,
    projectedSurplus,
  }

  // Map annual expenses
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

  // Map properties
  const propertyData: PropertyForForecast[] = properties.map((p) => ({
    id: p.id,
    name: p.name,
    currentValue: p.currentValue ?? 0,
    loanBalance: p.loanBalance,
    interestRate: p.interestRate,
    monthlyPayment: p.monthlyPayment,
    appreciationRate: p.appreciationRate ?? 0.03,
    monthlyRentalIncome: (p as Record<string, unknown>).monthlyRentalIncome as number ?? 0,
  }))

  // Map income transitions
  const incomeTransitionData: IncomeTransition[] = Array.isArray(profile.incomeTransitions)
    ? (profile.incomeTransitions as unknown as IncomeTransition[])
    : []

  return {
    goal: goalTarget,
    snapshots: snapshotData,
    debts: debtData,
    accounts: accountData,
    budgets: budgetSummary,
    annualExpenses: annualExpenseData,
    properties: propertyData,
    incomeTransitions: incomeTransitionData,
  }
}

function applyScenario(
  input: ForecastInput,
  scenarioType: string,
  params: Record<string, unknown>,
): ForecastInput {
  const modified = { ...input }

  switch (scenarioType) {
    case 'new_expense': {
      const amount = Number(params?.amount ?? 0)
      modified.budgets = {
        ...input.budgets,
        flexibleTotal: input.budgets.flexibleTotal + amount,
        totalBudgeted: input.budgets.totalBudgeted + amount,
        projectedSurplus: input.budgets.projectedSurplus - amount,
      }
      break
    }
    case 'new_debt': {
      const principal = Number(params?.principal ?? 0)
      const rate = Number(params?.rate ?? 0.05)
      const term = Number(params?.term ?? 60)
      const payment = monthlyPayment(principal, rate, term)
      modified.debts = [
        ...input.debts,
        {
          id: 'scenario-new-debt',
          name: String(params?.name ?? 'New Debt'),
          type: 'PERSONAL_LOAN',
          balance: principal,
          interestRate: rate,
          minimumPayment: payment,
        },
      ]
      modified.budgets = {
        ...input.budgets,
        fixedTotal: input.budgets.fixedTotal + payment,
        totalBudgeted: input.budgets.totalBudgeted + payment,
        projectedSurplus: input.budgets.projectedSurplus - payment,
      }
      break
    }
    case 'income_change': {
      const amount = Number(params?.amount ?? 0)
      modified.budgets = {
        ...input.budgets,
        expectedMonthlyIncome: input.budgets.expectedMonthlyIncome + amount,
        projectedSurplus: input.budgets.projectedSurplus + amount,
      }
      break
    }
    default:
      break
  }

  return modified
}
