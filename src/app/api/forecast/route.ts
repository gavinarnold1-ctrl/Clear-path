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
  const delayMonths = Number(params?.delayMonths ?? 0)

  // Build modified input based on scenario type
  const modifiedInput = applyScenario(input, scenarioType, params)
  const impact = computeScenarioImpact(baseline, modifiedInput)

  // Compute the full modified forecast (for timeline + projected date)
  const modifiedForecast = computeForecast(modifiedInput)

  // For delayed scenarios, build a hybrid timeline:
  // baseline values for months 0..(delayMonths-1), then scenario values shifted
  let effectiveForecast = modifiedForecast
  if (delayMonths > 0 && delayMonths < baseline.timeline.length) {
    const hybridTimeline = baseline.timeline.map((basePoint, i) => {
      if (i < delayMonths) return { ...basePoint }
      // After delay: use scenario delta applied to the baseline at this point
      const scenarioPoint = modifiedForecast.timeline[i - delayMonths]
      const baseAtDelay = baseline.timeline[delayMonths - 1]
      if (!scenarioPoint || !baseAtDelay) return { ...basePoint }
      const scenarioDelta = (scenarioPoint.projected ?? 0) - (baseline.timeline[i - delayMonths]?.projected ?? 0)
      return {
        ...basePoint,
        projected: (basePoint.projected ?? 0) + scenarioDelta,
      }
    })

    // Find new projected date after delay
    let hybridProjectedDate: string | null = null
    const targetVal = input.goal?.targetValue ?? 0
    for (const point of hybridTimeline) {
      if (!point.isHistorical && point.projected >= targetVal) {
        hybridProjectedDate = point.month
        break
      }
    }

    effectiveForecast = {
      ...modifiedForecast,
      timeline: hybridTimeline,
      projectedDate: hybridProjectedDate,
    }
  }

  // Build month-by-month breakdown, handling timeline length mismatches
  // Cap at 36 months to keep the table manageable
  const maxLen = Math.min(36, Math.max(baseline.timeline.length, effectiveForecast.timeline.length))
  const monthlyBreakdown: MonthlyBreakdownRow[] = []
  let cumulative = 0
  const startValue = input.goal?.startValue ?? 0

  for (let i = 0; i < maxLen; i++) {
    const basePoint = baseline.timeline[i] ?? baseline.timeline[baseline.timeline.length - 1]
    const scenarioPoint = effectiveForecast.timeline[i] ?? effectiveForecast.timeline[effectiveForecast.timeline.length - 1]

    // Extract cumulative projected values
    const baseCurrent = basePoint?.projected ?? basePoint?.actual ?? 0
    const scenarioCurrent = scenarioPoint?.projected ?? scenarioPoint?.actual ?? 0

    // Compute monthly gains by diffing consecutive cumulative values
    const basePrev = i > 0
      ? (baseline.timeline[i - 1]?.projected ?? baseline.timeline[i - 1]?.actual ?? 0)
      : startValue
    const scenarioPrev = i > 0
      ? (effectiveForecast.timeline[i - 1]?.projected ?? effectiveForecast.timeline[i - 1]?.actual ?? 0)
      : startValue
    const baseMonthlyGain = baseCurrent - basePrev
    const scenarioMonthlyGain = scenarioCurrent - scenarioPrev

    // Delta = how much more (or less) the scenario gains this month vs baseline
    const delta = scenarioMonthlyGain - baseMonthlyGain
    cumulative += delta

    monthlyBreakdown.push({
      month: (baseline.timeline[i] ?? effectiveForecast.timeline[i])?.month ?? basePoint?.month ?? '',
      baselineValue: Math.round(baseMonthlyGain * 100) / 100,
      scenarioValue: Math.round(scenarioMonthlyGain * 100) / 100,
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
    scenarioTimeline: effectiveForecast.timeline,
    monthlyBreakdown,
    baselineProjectedDate: baseline.projectedDate ?? null,
    scenarioProjectedDate: effectiveForecast.projectedDate ?? null,
    delayMonths: delayMonths > 0 ? delayMonths : undefined,
    narrativeSummary,
    propertyEquityGrowth: effectiveForecast.propertyEquityGrowth ?? null,
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

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)

  const [snapshots, debts, accounts, budgets, annualExpenses, properties, incomeAgg, priorIncomeAgg] = await Promise.all([
    db.monthlySnapshot.findMany({
      where: { userId, month: { gte: twelveMonthsAgo } },
      orderBy: { month: 'asc' },
    }),
    db.debt.findMany({
      where: { userId },
      include: { account: true, property: { select: { groupId: true } } },
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
    db.transaction.aggregate({
      where: { userId, date: { gte: startOfMonth }, classification: 'income' },
      _sum: { amount: true },
    }),
    db.transaction.aggregate({
      where: { userId, date: { gte: threeMonthsAgo, lt: startOfMonth }, classification: 'income' },
      _sum: { amount: true },
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
    escrowAmount: d.escrowAmount ?? 0,
    propertyGroupId: d.property?.groupId ?? null,
    propertyId: d.propertyId ?? null,
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
  // Income resolution: match True Remaining logic so forecast and dashboard agree
  const rawIncome = incomeAgg._sum.amount ?? 0
  const autoExpectedIncome = (priorIncomeAgg._sum.amount ?? 0) / 3
  const resolvedIncome = profile.expectedMonthlyIncome
    ?? (autoExpectedIncome > 0 ? autoExpectedIncome : rawIncome)
  const expectedMonthlyIncome = resolvedIncome + totalMonthlyRentalIncome
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

  // Map properties — include all properties, treating null currentValue as 0
  const propertyData: PropertyForForecast[] = properties.map((p) => ({
    id: p.id,
    name: p.name,
    currentValue: p.currentValue ?? 0,
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
          escrowAmount: 0,
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

      const resolvedTarget = targetDebtId
        ? input.debts.find((d) => d.id === targetDebtId)
        : [...input.debts].sort((a, b) => b.interestRate - a.interestRate)[0]

      if (resolvedTarget) {
        modified.debts = input.debts.map((d) =>
          d.id === resolvedTarget.id
            ? { ...d, minimumPayment: d.minimumPayment + amount }
            : d
        )

        // Update linked property's monthly payment so equity growth reflects extra paydown
        if (resolvedTarget.propertyId && input.properties) {
          modified.properties = (input.properties).map((p) =>
            p.id === resolvedTarget.propertyId
              ? { ...p, monthlyPayment: (p.monthlyPayment ?? 0) + amount }
              : p
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
    case 'refinance': {
      const newRate = Number(params?.rate ?? 0.05)
      const newTerm = Number(params?.term ?? 360)
      const targetDebtId = params?.debtId as string | undefined

      // Find target debt (specific or highest-rate)
      const target = targetDebtId
        ? input.debts.find((d) => d.id === targetDebtId)
        : [...input.debts].sort((a, b) => b.interestRate - a.interestRate)[0]

      if (target) {
        // When the target belongs to a property group, refinance all debts in that group
        // (e.g. a single mortgage split across multi-unit properties)
        const groupId = target.propertyGroupId
        const affectedDebts = groupId
          ? input.debts.filter((d) => d.propertyGroupId === groupId)
          : [target]

        const combinedBalance = affectedDebts.reduce((s, d) => s + d.balance, 0)
        const combinedEscrow = affectedDebts.reduce((s, d) => s + (d.escrowAmount ?? 0), 0)
        const combinedOldPmt = affectedDebts.reduce((s, d) => s + d.minimumPayment, 0)

        const newPmtPI = monthlyPayment(combinedBalance, newRate, newTerm)
        // Escrow (taxes, insurance) doesn't change with a refinance — add it back
        const newPmtTotal = newPmtPI + combinedEscrow
        const savings = combinedOldPmt - newPmtTotal

        // Distribute the new payment proportionally across affected debts
        const affectedIds = new Set(affectedDebts.map((d) => d.id))
        modified.debts = input.debts.map((d) => {
          if (!affectedIds.has(d.id)) return d
          const share = combinedBalance > 0 ? d.balance / combinedBalance : 1 / affectedDebts.length
          return { ...d, interestRate: newRate, minimumPayment: newPmtTotal * share }
        })
        modified.budgets = {
          ...input.budgets,
          fixedTotal: input.budgets.fixedTotal - combinedOldPmt + newPmtTotal,
          totalBudgeted: input.budgets.totalBudgeted - combinedOldPmt + newPmtTotal,
          projectedSurplus: input.budgets.projectedSurplus + savings,
        }

        // Update linked properties so property equity growth reflects the new rate/payment
        const affectedPropertyIds = new Set(
          affectedDebts.map((d) => d.propertyId).filter(Boolean) as string[]
        )
        if (affectedPropertyIds.size > 0 && input.properties) {
          modified.properties = (input.properties).map((p) => {
            if (!affectedPropertyIds.has(p.id)) return p
            // Find the refinanced debt for this property
            const debt = affectedDebts.find((d) => d.propertyId === p.id)
            if (!debt) return p
            const share = combinedBalance > 0 ? debt.balance / combinedBalance : 1 / affectedDebts.length
            return {
              ...p,
              loanBalance: debt.balance,
              interestRate: newRate,
              monthlyPayment: newPmtTotal * share,
            }
          })
        }
      }
      break
    }
    default:
      break
  }

  return modified
}
