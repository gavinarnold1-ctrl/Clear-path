import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { computeForecast, autoDetectAssetClass, computeScenarioImpact, computeForecastAccuracy } from '@/lib/engines/forecast'
import { monthlyPayment } from '@/lib/engines/amortization'
import { buildNarrativeSummary } from '@/lib/engines/scenario-narrative'
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
  MonthlyBreakdownRow,
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
  return NextResponse.json({ forecast, accuracy }, {
    headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=300' },
  })
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

  // Compute the full modified forecast (for timeline + projected date)
  const modifiedForecast = computeForecast(modifiedInput)

  // Build month-by-month breakdown, handling timeline length mismatches
  const maxLen = Math.max(baseline.timeline.length, modifiedForecast.timeline.length)
  const monthlyBreakdown: MonthlyBreakdownRow[] = []
  let cumulative = 0

  for (let i = 0; i < maxLen; i++) {
    const basePoint = baseline.timeline[i] ?? baseline.timeline[baseline.timeline.length - 1]
    const scenarioPoint = modifiedForecast.timeline[i] ?? modifiedForecast.timeline[modifiedForecast.timeline.length - 1]
    const baseValue = basePoint?.projected ?? basePoint?.actual ?? 0
    const scenarioValue = scenarioPoint?.projected ?? scenarioPoint?.actual ?? 0
    const delta = scenarioValue - baseValue
    cumulative += delta

    monthlyBreakdown.push({
      month: (baseline.timeline[i] ?? modifiedForecast.timeline[i])?.month ?? basePoint?.month ?? '',
      baselineValue: baseValue,
      scenarioValue: scenarioValue,
      delta: Math.round(delta * 100) / 100,
      cumulativeImpact: Math.round(cumulative * 100) / 100,
    })
  }

  // Build narrative summary
  const narrativeSummary = buildNarrativeSummary({
    ...impact,
    baselineProjectedDate: baseline.projectedDate ?? null,
  })

  const scenario = {
    id: crypto.randomUUID(),
    label: params?.label ?? `Custom ${scenarioType}`,
    description: params?.description ?? '',
    type: scenarioType,
    impact,
    scenarioTimeline: modifiedForecast.timeline,
    monthlyBreakdown,
    baselineProjectedDate: baseline.projectedDate ?? null,
    scenarioProjectedDate: modifiedForecast.projectedDate ?? null,
    narrativeSummary,
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
  const totalMonthlyRentalIncome = properties.reduce(
    (sum, p) => sum + (Number(p.monthlyRentalIncome) || 0), 0
  )
  const expectedMonthlyIncome = (profile.expectedMonthlyIncome ?? 0) + totalMonthlyRentalIncome
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

  // Map properties — filter out properties without a known current value
  // (null currentValue with a loanBalance would produce negative equity)
  const propertyData: PropertyForForecast[] = properties
    .filter((p) => p.currentValue != null && p.currentValue > 0)
    .map((p) => ({
      id: p.id,
      name: p.name,
      currentValue: p.currentValue!,
      loanBalance: p.loanBalance,
      interestRate: p.interestRate,
      monthlyPayment: p.monthlyPayment,
      appreciationRate: p.appreciationRate ?? 0.03,
      monthlyRentalIncome: Number(p.monthlyRentalIncome) || 0,
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
    case 'extra_debt_payment': {
      const amount = Number(params?.amount ?? 0)
      const targetDebtId = params?.debtId as string | undefined

      if (targetDebtId) {
        modified.debts = input.debts.map((d) =>
          d.id === targetDebtId
            ? { ...d, minimumPayment: d.minimumPayment + amount }
            : d
        )
      } else {
        // Apply to highest-rate debt
        const sorted = [...input.debts].sort((a, b) => b.interestRate - a.interestRate)
        if (sorted[0]) {
          modified.debts = input.debts.map((d) =>
            d.id === sorted[0].id
              ? { ...d, minimumPayment: d.minimumPayment + amount }
              : d
          )
        }
      }
      modified.budgets = {
        ...input.budgets,
        projectedSurplus: input.budgets.projectedSurplus - amount,
      }
      break
    }
    case 'property_value_change': {
      const propertyId = params?.propertyId as string | undefined
      const newValue = params?.newValue != null ? Number(params.newValue) : undefined
      const newAppreciation = params?.appreciationRate != null ? Number(params.appreciationRate) : undefined

      modified.properties = (input.properties ?? []).map((p) => {
        if (propertyId && p.id !== propertyId) return p
        return {
          ...p,
          ...(newValue != null ? { currentValue: newValue } : {}),
          ...(newAppreciation != null ? { appreciationRate: newAppreciation } : {}),
        }
      })
      break
    }
    case 'lump_sum_payment': {
      const amount = Number(params?.amount ?? 0)
      const targetDebtId = params?.debtId as string | undefined

      modified.debts = input.debts.map((d) => {
        if (targetDebtId && d.id !== targetDebtId) return d
        if (!targetDebtId) return d
        return { ...d, balance: Math.max(0, d.balance - amount) }
      })
      break
    }
    case 'cut_spending': {
      const percentage = Number(params?.percentage ?? 10) / 100
      const reduction = input.budgets.flexibleTotal * percentage
      modified.budgets = {
        ...input.budgets,
        flexibleTotal: input.budgets.flexibleTotal * (1 - percentage),
        totalBudgeted: input.budgets.totalBudgeted - reduction,
        projectedSurplus: input.budgets.projectedSurplus + reduction,
      }
      break
    }
    case 'savings_boost': {
      const amount = Number(params?.amount ?? 0)
      modified.budgets = {
        ...input.budgets,
        projectedSurplus: input.budgets.projectedSurplus + amount,
      }
      break
    }
    default:
      break
  }

  return modified
}
