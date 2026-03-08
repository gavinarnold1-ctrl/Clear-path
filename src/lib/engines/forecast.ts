/**
 * Forecast engine — pure computation, no database or framework imports.
 *
 * Projects goal progress forward using snapshot trends, asset growth,
 * property appreciation, and debt amortization. Generates scenarios
 * showing how changes affect the projected goal completion date.
 */

import { monthlyPayment, amortizationSchedule } from './amortization'
import type {
  AssetClass,
  AssetClassConfig,
  GoalMetric,
  GoalTarget,
  ForecastInput,
  IncomeTransition,
  MonthlySnapshotData,
  AccountForForecast,
  PropertyForForecast,
  BudgetSummaryForForecast,
  Forecast,
  ForecastPoint,
  AssetGrowthProjection,
  ForecastScenario,
  ForecastAccuracy,
  ForecastAccuracyPoint,
  DebtForForecast,
} from '@/types'

// ── 3A: Asset class defaults ────────────────────────────────────────────────

export const ASSET_CLASS_DEFAULTS: Record<AssetClass, AssetClassConfig> = {
  cash: {
    expectedAnnualReturn: 0.0,
    riskWeight: 1.0,
    volatility: 0.0,
    label: 'Cash (Checking)',
  },
  high_yield_savings: {
    expectedAnnualReturn: 0.045,
    riskWeight: 0.98,
    volatility: 0.005,
    label: 'High-Yield Savings',
  },
  bonds: {
    expectedAnnualReturn: 0.04,
    riskWeight: 0.9,
    volatility: 0.05,
    label: 'Bonds',
  },
  index_fund: {
    expectedAnnualReturn: 0.1,
    riskWeight: 0.7,
    volatility: 0.15,
    label: 'Index Funds',
  },
  mutual_fund: {
    expectedAnnualReturn: 0.08,
    riskWeight: 0.65,
    volatility: 0.14,
    label: 'Mutual Funds',
  },
  individual_stock: {
    expectedAnnualReturn: 0.1,
    riskWeight: 0.5,
    volatility: 0.25,
    label: 'Individual Stocks',
  },
  crypto: {
    expectedAnnualReturn: 0.15,
    riskWeight: 0.3,
    volatility: 0.6,
    label: 'Cryptocurrency',
  },
  real_estate: {
    expectedAnnualReturn: 0.03,
    riskWeight: 0.85,
    volatility: 0.04,
    label: 'Real Estate',
  },
  other: {
    expectedAnnualReturn: 0.03,
    riskWeight: 0.6,
    volatility: 0.1,
    label: 'Other Assets',
  },
}

// ── 3B: Auto-detect asset class from account type ───────────────────────────

export function autoDetectAssetClass(accountType: string): AssetClass {
  switch (accountType) {
    case 'CHECKING':
      return 'cash'
    case 'SAVINGS':
      return 'high_yield_savings'
    case 'INVESTMENT':
      return 'index_fund'
    default:
      return 'cash'
  }
}

// ── 3C: Resolve user overrides vs defaults ──────────────────────────────────

export function getAssetConfig(account: AccountForForecast): AssetClassConfig {
  const defaults = ASSET_CLASS_DEFAULTS[account.assetClass] ?? ASSET_CLASS_DEFAULTS.other
  return {
    ...defaults,
    expectedAnnualReturn: account.expectedReturn ?? defaults.expectedAnnualReturn,
    riskWeight: account.riskWeight ?? defaults.riskWeight,
  }
}

// ── 3D: Compute monthly velocity (weighted moving average) ──────────────────

export function computeMonthlyVelocity(
  snapshots: MonthlySnapshotData[],
  metric: GoalMetric,
): number {
  if (snapshots.length === 0) return 0

  const values = snapshots.map((s) => extractMetricValue(s, metric))

  if (values.length === 1) {
    return values[0]
  }

  // Compute month-over-month deltas
  const deltas: number[] = []
  for (let i = 1; i < values.length; i++) {
    deltas.push(values[i] - values[i - 1])
  }

  if (deltas.length === 0) return 0

  // For rate-based metrics and savings_amount, use the average level (not deltas).
  // savings_amount uses netSurplus (income - expenses) per month — we want the
  // average monthly savings rate, not the acceleration of savings.
  if (metric === 'savings_rate' || metric === 'categorization_pct' || metric === 'savings_amount') {
    return weightedAverage(values)
  }

  // For absolute metrics, use weighted average of deltas
  return weightedAverage(deltas)
}

function extractMetricValue(snapshot: MonthlySnapshotData, metric: GoalMetric): number {
  switch (metric) {
    case 'savings_amount':
      return snapshot.netSurplus
    case 'savings_rate':
      return snapshot.savingsRate
    case 'debt_payoff':
    case 'debt_total':
      return snapshot.debtPaidDown ?? 0
    case 'category_spend':
      return Math.abs(snapshot.totalExpenses)
    case 'categorization_pct':
      return 0 // Would need transaction-level data
    case 'categories_at_benchmark':
      return 0 // Would need benchmark comparison data
    case 'net_worth_increase':
    case 'net_worth_target':
      return snapshot.netWorth ?? 0
    default:
      return 0
  }
}

function weightedAverage(values: number[]): number {
  if (values.length === 0) return 0

  // Take last 6 values max
  const recent = values.slice(-6)
  let totalWeight = 0
  let weightedSum = 0

  for (let i = 0; i < recent.length; i++) {
    // Most recent = 3x, 2nd most recent = 2x, rest = 1x
    const fromEnd = recent.length - 1 - i
    const weight = fromEnd === 0 ? 3 : fromEnd === 1 ? 2 : 1
    weightedSum += recent[i] * weight
    totalWeight += weight
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0
}

// ── 3E: Project asset growth ────────────────────────────────────────────────

export function projectAssetGrowth(
  account: AccountForForecast,
  months: number,
): AssetGrowthProjection {
  const config = getAssetConfig(account)
  const monthlyReturn = config.expectedAnnualReturn / 12
  const riskWeightedReturn = monthlyReturn * config.riskWeight
  const monthlyVolatility = config.volatility / Math.sqrt(12)

  // Risk-weighted projection (expected case)
  const projected = account.balance * Math.pow(1 + riskWeightedReturn, months)

  // Optimistic (full expected return)
  const optimistic = account.balance * Math.pow(1 + monthlyReturn, months)

  // Conservative (risk-weighted minus 1 std dev)
  const conservativeReturn = Math.max(0, riskWeightedReturn - monthlyVolatility)
  const conservative = account.balance * Math.pow(1 + conservativeReturn, months)

  return {
    accountId: account.id,
    accountName: account.name,
    assetClass: account.assetClass,
    currentBalance: account.balance,
    projectedBalance12mo: round2(projected),
    expectedGrowth: round2(projected - account.balance),
    uncertaintyRange: {
      low: round2(conservative),
      high: round2(optimistic),
    },
  }
}

// ── 3F: Project property equity ─────────────────────────────────────────────

export function projectPropertyEquity(
  property: PropertyForForecast,
  months: number,
): { appreciatedValue: number; remainingBalance: number; equity: number } {
  const monthlyAppreciation = (property.appreciationRate ?? 0.03) / 12
  const appreciatedValue = property.currentValue * Math.pow(1 + monthlyAppreciation, months)

  let remainingBalance = property.loanBalance ?? 0
  if (property.loanBalance && property.interestRate != null && property.monthlyPayment) {
    const schedule = amortizationSchedule({
      principal: property.loanBalance,
      annualRate: property.interestRate,
      termMonths: months + 360, // Use long term to get the schedule
    })
    const row = schedule.schedule[Math.min(months - 1, schedule.schedule.length - 1)]
    remainingBalance = row ? row.remainingBalance : 0
  }

  return {
    appreciatedValue: round2(appreciatedValue),
    remainingBalance: round2(remainingBalance),
    equity: round2(appreciatedValue - remainingBalance),
  }
}

// ── 3G: Main forecast computation ───────────────────────────────────────────

export function computeForecast(input: ForecastInput): Forecast {
  const { goal, snapshots, debts, accounts, budgets, properties } = input

  // 1. Compute current value based on goal metric
  const currentValue = computeCurrentValue(goal, snapshots, debts, accounts, properties)

  // 2. Compute monthly velocity from snapshots
  const snapshotVelocity = computeMonthlyVelocity(snapshots, goal.metric)

  // 2b. Adjust velocity for rental income (snapshots may not capture it)
  const rentalIncomeAdj = (properties ?? []).reduce(
    (sum, prop) => sum + (prop.monthlyRentalIncome ?? 0), 0
  )
  let monthlyVelocity = snapshotVelocity + rentalIncomeAdj

  // 2c. For savings goals, use budget surplus as velocity when it's better than snapshot data
  // Budget surplus = planned income - planned spending, representing forward-looking intent
  if (goal.metric === 'savings_amount') {
    if (monthlyVelocity < 0 && budgets.projectedSurplus > monthlyVelocity) {
      monthlyVelocity = Math.max(0, budgets.projectedSurplus)
    }
  }

  // 3. Compute required velocity
  const now = new Date()
  const targetDate = new Date(goal.targetDate)
  const monthsToTarget = monthsBetween(now, targetDate)
  const remaining = goal.targetValue - currentValue
  const requiredVelocity = monthsToTarget > 0 ? remaining / monthsToTarget : remaining

  // 4. Determine pace (uses rental-adjusted velocity)
  const { pace, paceDetail, daysAhead } = determinePace(
    monthlyVelocity,
    requiredVelocity,
    currentValue,
    goal,
    monthsToTarget,
  )

  // 5. Project timeline — use budget-surplus-adjusted velocity (without rental, since
  //    projectTimeline adds rental internally) so the chart reflects the budget plan
  let timelineVelocity = snapshotVelocity
  if (goal.metric === 'savings_amount') {
    if (snapshotVelocity < 0 && budgets.projectedSurplus > snapshotVelocity) {
      timelineVelocity = Math.max(0, budgets.projectedSurplus)
    }
  }
  const timeline = projectTimeline(goal, snapshots, timelineVelocity, requiredVelocity, accounts, properties, budgets, input.incomeTransitions)

  // 6. Compute projected date (uses rental-adjusted velocity)
  const projectedDate = computeProjectedDate(currentValue, goal.targetValue, monthlyVelocity, now)

  // 7. Projected value at target date (uses rental-adjusted velocity)
  const projectedValue = currentValue + monthlyVelocity * Math.max(0, monthsToTarget)

  // 8. Asset growth projections (non-liability accounts only)
  const LIABILITY_TYPES = new Set(['CREDIT_CARD', 'MORTGAGE', 'AUTO_LOAN', 'STUDENT_LOAN'])
  const assetGrowth = accounts
    .filter((a) => !LIABILITY_TYPES.has(a.type) && a.balance > 0)
    .map((a) => projectAssetGrowth(a, 12))

  // 8b. Property equity growth (computed for ALL goals, displayed as supplemental info)
  let propertyEquityGrowth: ReturnType<typeof computePropertyEquityGrowth> = null
  if (properties && properties.length > 0) {
    propertyEquityGrowth = computePropertyEquityGrowth(properties)
  }

  // 9. Generate scenarios
  const scenarios = generateDefaultScenarios(input)

  // 10. Compute confidence
  const { confidence, confidenceReason } = computeConfidence(snapshots, monthlyVelocity)

  // 11. Generate tab summaries
  const tabSummaries = generateTabSummaries(
    pace,
    currentValue,
    goal,
    monthlyVelocity,
    projectedDate,
    debts,
    budgets,
    input.incomeTransitions,
  )

  // 12. Compute progress percent
  const totalRange = goal.targetValue - goal.startValue
  const progressPercent =
    totalRange !== 0 ? Math.min(100, Math.max(0, ((currentValue - goal.startValue) / totalRange) * 100)) : 0

  return {
    currentValue: round2(currentValue),
    progressPercent: round2(progressPercent),
    pace,
    paceDetail,
    monthlyVelocity: round2(monthlyVelocity),
    requiredVelocity: round2(requiredVelocity),
    projectedDate,
    projectedValue: round2(projectedValue),
    daysAhead,
    timeline,
    scenarios,
    confidence,
    confidenceReason,
    tabSummaries,
    assetGrowth,
    propertyEquityGrowth,
  }
}

// ── 3H: Scenario impact computation ────────────────────────────────────────

export function computeScenarioImpact(
  baselineForecast: Forecast,
  modifiedInput: ForecastInput,
): ForecastScenario['impact'] {
  const modified = computeForecast(modifiedInput)

  const baselineDays = baselineForecast.projectedDate
    ? daysBetween(new Date(), new Date(baselineForecast.projectedDate))
    : 0
  const modifiedDays = modified.projectedDate
    ? daysBetween(new Date(), new Date(modified.projectedDate))
    : 0

  return {
    newProjectedDate: modified.projectedDate,
    daysSaved: baselineDays - modifiedDays,
    monthlyImpactOnTrueRemaining: round2(modified.monthlyVelocity - baselineForecast.monthlyVelocity),
    monthlyImpactOnGoal: round2(modified.requiredVelocity - baselineForecast.requiredVelocity),
    budgetCategoriesAffected: [],
    annualExpensesAffected: [],
  }
}

// ── 3I: Generate default scenarios ──────────────────────────────────────────

export function generateDefaultScenarios(input: ForecastInput): ForecastScenario[] {
  const { goal, debts, accounts, budgets } = input
  const archetype = goal.archetype ?? 'save_more'
  const scenarios: ForecastScenario[] = []

  const baseline = computeForecastLight(input)

  switch (archetype) {
    case 'save_more': {
      // Cut largest flexible spending by 10%
      if (budgets.flexibleTotal > 0) {
        const cutAmount = round2(budgets.flexibleTotal * 0.1)
        scenarios.push(
          buildScenario('cut-flexible-10', 'Cut flexible spending 10%', `Reduce flexible budget by ${formatDollar(cutAmount)}/mo`, 'cut', baseline, {
            ...input,
            budgets: {
              ...budgets,
              flexibleTotal: budgets.flexibleTotal - cutAmount,
              projectedSurplus: budgets.projectedSurplus + cutAmount,
            },
          }),
        )
      }
      // Move cash to HYSA
      const cashAccounts = accounts.filter((a) => a.assetClass === 'cash' && a.balance > 1000)
      if (cashAccounts.length > 0) {
        const cashTotal = cashAccounts.reduce((s, a) => s + a.balance, 0)
        const keepInChecking = 1000
        const moveAmount = cashTotal - keepInChecking
        if (moveAmount > 500) {
          scenarios.push({
            id: 'move-to-hysa',
            label: 'Move cash to high-yield savings',
            description: `Move ${formatDollar(moveAmount)} from checking to HYSA earning ~4.5%`,
            type: 'investment',
            impact: {
              newProjectedDate: baseline.projectedDate,
              daysSaved: 0,
              monthlyImpactOnTrueRemaining: 0,
              monthlyImpactOnGoal: round2(moveAmount * 0.045 / 12),
              budgetCategoriesAffected: [],
              annualExpensesAffected: [],
            },
          })
        }
      }
      break
    }
    case 'pay_off_debt': {
      // Add $100/mo extra
      if (debts.length > 0) {
        scenarios.push(
          buildDebtExtraScenario('extra-100', 'Add $100/mo extra payment', 100, debts, baseline, input),
        )
        // Add $250/mo extra
        scenarios.push(
          buildDebtExtraScenario('extra-250', 'Add $250/mo extra payment', 250, debts, baseline, input),
        )
        // Refinance if rate > 5%
        const highRateDebts = debts.filter((d) => d.interestRate > 0.05 && d.type === 'MORTGAGE')
        for (const debt of highRateDebts.slice(0, 1)) {
          const newRate = 0.052
          const oldPayment = debt.minimumPayment
          const newPayment = monthlyPayment(debt.balance, newRate, 360)
          const savings = oldPayment - newPayment
          if (savings > 0) {
            scenarios.push({
              id: `refinance-${debt.id}`,
              label: `Refinance ${debt.name}`,
              description: `Refinance from ${(debt.interestRate * 100).toFixed(1)}% to ${(newRate * 100).toFixed(1)}%`,
              type: 'refinance',
              impact: {
                newProjectedDate: null,
                daysSaved: Math.round(savings * 30 / (debt.balance * debt.interestRate / 12 + 1)),
                monthlyImpactOnTrueRemaining: round2(savings),
                monthlyImpactOnGoal: round2(savings),
                totalInterestImpact: round2(savings * 360),
                newMonthlyPayment: round2(newPayment),
                budgetCategoriesAffected: [],
                annualExpensesAffected: [],
              },
            })
          }
        }
      }
      break
    }
    case 'spend_smarter': {
      // Cut flexible by 10% and 25%
      if (budgets.flexibleTotal > 0) {
        const cut10 = round2(budgets.flexibleTotal * 0.1)
        scenarios.push(
          buildScenario('cut-10', 'Cut target spending 10%', `Save ${formatDollar(cut10)}/mo by reducing flexible spending`, 'cut', baseline, {
            ...input,
            budgets: {
              ...budgets,
              flexibleTotal: budgets.flexibleTotal - cut10,
              projectedSurplus: budgets.projectedSurplus + cut10,
            },
          }),
        )
        const cut25 = round2(budgets.flexibleTotal * 0.25)
        scenarios.push(
          buildScenario('cut-25', 'Cut target spending 25%', `Save ${formatDollar(cut25)}/mo by aggressive reduction`, 'cut', baseline, {
            ...input,
            budgets: {
              ...budgets,
              flexibleTotal: budgets.flexibleTotal - cut25,
              projectedSurplus: budgets.projectedSurplus + cut25,
            },
          }),
        )
      }
      break
    }
    case 'build_wealth': {
      // Increase savings rate by 5%
      if (budgets.expectedMonthlyIncome > 0) {
        const additional = round2(budgets.expectedMonthlyIncome * 0.05)
        scenarios.push(
          buildScenario('save-5pct-more', 'Increase savings rate by 5%', `Save an additional ${formatDollar(additional)}/mo`, 'income', baseline, {
            ...input,
            budgets: {
              ...budgets,
              projectedSurplus: budgets.projectedSurplus + additional,
            },
          }),
        )
      }
      // Accelerate high-rate debt
      const highRateDebt = debts.filter((d) => d.interestRate > 0.06).sort((a, b) => b.interestRate - a.interestRate)
      if (highRateDebt.length > 0) {
        scenarios.push(
          buildDebtExtraScenario('accelerate-debt', `Accelerate ${highRateDebt[0].name} payoff`, 200, highRateDebt, baseline, input),
        )
      }
      break
    }
    case 'gain_visibility': {
      // For visibility goals, scenarios are less numerical
      scenarios.push({
        id: 'weekly-review',
        label: 'Weekly spending review',
        description: 'Review and categorize transactions weekly to maintain visibility',
        type: 'cut',
        impact: {
          newProjectedDate: baseline.projectedDate,
          daysSaved: 0,
          monthlyImpactOnTrueRemaining: 0,
          monthlyImpactOnGoal: 0,
          budgetCategoriesAffected: [],
          annualExpensesAffected: [],
        },
      })
      break
    }
  }

  // Universal scenario: buy a car (if no AUTO debt)
  const hasAuto = debts.some((d) => d.type === 'AUTO')
  if (!hasAuto) {
    const carPayment = monthlyPayment(35000, 0.03, 60)
    scenarios.push({
      id: 'buy-car',
      label: 'Buy a car ($35K)',
      description: '$35,000 auto loan at 3% for 60 months',
      type: 'debt',
      impact: {
        newProjectedDate: null,
        daysSaved: 0,
        monthlyImpactOnTrueRemaining: round2(-carPayment),
        monthlyImpactOnGoal: round2(-carPayment),
        newMonthlyPayment: round2(carPayment),
        budgetCategoriesAffected: [],
        annualExpensesAffected: [],
      },
    })
  }

  return scenarios
}

// ── Internal helpers ────────────────────────────────────────────────────────

function computePropertyEquityGrowth(properties: PropertyForForecast[]) {
  const propertiesWithValue = properties.filter((p) => p.currentValue > 0)
  if (propertiesWithValue.length === 0) return null

  let totalAppreciation = 0
  let totalPrincipalPaydown = 0
  const details: { name: string; appreciation: number; principalPaydown: number }[] = []

  for (const p of propertiesWithValue) {
    const appreciation = p.currentValue * (p.appreciationRate ?? 0.03)
    let principalPaydown = 0
    if (p.loanBalance && p.interestRate != null && p.monthlyPayment) {
      const monthlyInterest = p.loanBalance * (p.interestRate / 12)
      principalPaydown = Math.max(0, p.monthlyPayment - monthlyInterest) * 12
    }
    totalAppreciation += appreciation
    totalPrincipalPaydown += principalPaydown
    details.push({
      name: p.name,
      appreciation: round2(appreciation),
      principalPaydown: round2(principalPaydown),
    })
  }

  return {
    annualAppreciation: round2(totalAppreciation),
    annualPrincipalPaydown: round2(totalPrincipalPaydown),
    annualTotal: round2(totalAppreciation + totalPrincipalPaydown),
    properties: details,
  }
}

function computeCurrentValue(
  goal: GoalTarget,
  snapshots: MonthlySnapshotData[],
  debts: DebtForForecast[],
  accounts: AccountForForecast[],
  properties?: PropertyForForecast[],
): number {
  if (goal.currentValue != null) return goal.currentValue

  const latestSnapshot = snapshots[snapshots.length - 1]
  const LIABILITY_TYPES = new Set(['CREDIT_CARD', 'MORTGAGE', 'AUTO_LOAN', 'STUDENT_LOAN'])

  switch (goal.metric) {
    case 'savings_amount': {
      return accounts
        .filter((a) => !LIABILITY_TYPES.has(a.type))
        .reduce((sum, a) => sum + a.balance, 0)
    }
    case 'savings_rate':
      return latestSnapshot?.savingsRate ?? 0
    case 'debt_payoff':
    case 'debt_total': {
      if (goal.linkedDebtId) {
        const debt = debts.find((d) => d.id === goal.linkedDebtId)
        return debt?.balance ?? 0
      }
      return debts.reduce((sum, d) => sum + d.balance, 0)
    }
    case 'category_spend':
      return Math.abs(latestSnapshot?.totalExpenses ?? 0)
    case 'categorization_pct':
      return 0
    case 'categories_at_benchmark':
      return 0
    case 'net_worth_increase':
    case 'net_worth_target': {
      const assetTotal = accounts
        .filter((a) => !LIABILITY_TYPES.has(a.type))
        .reduce((sum, a) => sum + a.balance, 0)
      const debtTotal = debts.reduce((sum, d) => sum + d.balance, 0)
      const propertyEquity = (properties ?? []).reduce((sum, p) => {
        return sum + p.currentValue - (p.loanBalance ?? 0)
      }, 0)
      return assetTotal - debtTotal + propertyEquity
    }
    default:
      return goal.startValue
  }
}

function determinePace(
  velocity: number,
  required: number,
  currentValue: number,
  goal: GoalTarget,
  monthsToTarget: number,
): { pace: Forecast['pace']; paceDetail: string; daysAhead: number } {
  // For debt metrics, "ahead" means paying down faster (velocity should be positive for debt reduction)
  const isDebtMetric = goal.metric === 'debt_payoff' || goal.metric === 'debt_total'

  // Normalize direction: for debt, target < start (paying down), so flip signs
  let effectiveVelocity = velocity
  let effectiveRequired = required

  if (isDebtMetric) {
    // For debt, we want to measure how much debt is being reduced per month
    effectiveVelocity = Math.abs(velocity)
    effectiveRequired = Math.abs(required)
  }

  if (effectiveRequired <= 0) {
    // Already at or past target
    return { pace: 'ahead', paceDetail: 'You have reached your target!', daysAhead: 0 }
  }

  const ratio = effectiveVelocity / effectiveRequired

  let pace: Forecast['pace']
  let paceDetail: string
  let daysAhead = 0

  if (ratio > 1.1) {
    pace = 'ahead'
    const monthsAhead = monthsToTarget > 0 ? (currentValue - goal.startValue) / effectiveRequired - (monthsFromDate(new Date(goal.startDate), new Date())) : 0
    daysAhead = Math.round(monthsAhead * 30)
    paceDetail = `Progressing ${((ratio - 1) * 100).toFixed(0)}% faster than needed`
  } else if (ratio >= 0.9) {
    pace = 'on_track'
    paceDetail = 'On track to reach your goal on time'
  } else if (ratio >= 0.7) {
    pace = 'behind'
    paceDetail = `${((1 - ratio) * 100).toFixed(0)}% below the required pace`
  } else if (ratio >= 0.5) {
    pace = 'at_risk'
    paceDetail = `Significantly behind — ${((1 - ratio) * 100).toFixed(0)}% below required pace`
  } else {
    pace = 'off_track'
    paceDetail = effectiveVelocity <= 0
      ? 'No progress detected — consider adjusting your approach'
      : 'Well below the required pace to reach your goal'
  }

  return { pace, paceDetail, daysAhead }
}

function projectTimeline(
  goal: GoalTarget,
  snapshots: MonthlySnapshotData[],
  velocity: number,
  requiredVelocity: number,
  accounts: AccountForForecast[],
  properties?: PropertyForForecast[],
  budgets?: BudgetSummaryForForecast,
  incomeTransitions?: IncomeTransition[],
): ForecastPoint[] {
  const points: ForecastPoint[] = []
  const startDate = new Date(goal.startDate)
  const targetDate = new Date(goal.targetDate)
  const now = new Date()

  // Extend 6 months past target
  const endDate = new Date(targetDate)
  endDate.setMonth(endDate.getMonth() + 6)

  // Build historical snapshot map
  const snapshotMap = new Map<string, MonthlySnapshotData>()
  for (const s of snapshots) {
    const d = new Date(s.month)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    snapshotMap.set(key, s)
  }

  // Calculate total monthly asset growth for non-cash accounts
  const LIABILITY_TYPES = new Set(['CREDIT_CARD', 'MORTGAGE', 'AUTO_LOAN', 'STUDENT_LOAN'])
  const growthAccounts = accounts.filter((a) => !LIABILITY_TYPES.has(a.type) && a.assetClass !== 'cash')
  const monthlyAssetGrowthRate = growthAccounts.reduce((sum, a) => {
    const config = getAssetConfig(a)
    return sum + (a.balance * config.expectedAnnualReturn * config.riskWeight) / 12
  }, 0)

  const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
  let monthIndex = 0
  const startValue = goal.startValue
  const baseIncome = budgets?.expectedMonthlyIncome ?? 0

  // Pre-sort income transitions by date for efficient lookup
  const sortedTransitions = (incomeTransitions ?? [])
    .filter((t) => t.date && t.monthlyIncome >= 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // For net-worth-related goals, compute monthly property equity growth
  // Use a 0.3 blending factor since snapshot velocity already partially captures equity gains
  const isNetWorthGoal = goal.metric === 'net_worth_target' || goal.metric === 'net_worth_increase'
  let monthlyEquityGrowth = 0
  if (isNetWorthGoal && properties && properties.length > 0) {
    // Include property equity in net worth projections
    monthlyEquityGrowth = properties.reduce((sum, prop) => {
      const monthlyAppreciation = (prop.appreciationRate ?? 0.03) / 12
      const appreciation = prop.currentValue * monthlyAppreciation
      let principalPaydown = 0
      if (prop.loanBalance && prop.interestRate != null && prop.monthlyPayment) {
        const monthlyInterest = prop.loanBalance * (prop.interestRate / 12)
        principalPaydown = Math.max(0, prop.monthlyPayment - monthlyInterest)
      }
      return sum + appreciation + principalPaydown
    }, 0) * 0.3 // blending factor to avoid double-counting with snapshot velocity
  }

  // Compute total monthly rental income across all properties
  // This offsets mortgage expenses in cash flow projections
  const totalMonthlyRentalIncome = (properties ?? []).reduce(
    (sum, prop) => sum + (prop.monthlyRentalIncome ?? 0), 0
  )

  // Accumulator for income-adjusted projection (cumulative velocity adjustments)
  let cumulativeIncomeAdj = 0

  while (current <= endDate) {
    const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`
    const isHistorical = current <= now
    const snapshot = snapshotMap.get(key)

    // Compute income adjustment for this month based on transitions
    // For future months, if an income transition applies, adjust velocity proportionally
    let incomeAdj = 0
    if (!isHistorical && sortedTransitions.length > 0 && baseIncome > 0) {
      // Find the active transition for this month (latest transition on or before this date)
      const monthStart = current.getTime()
      let activeTransition: IncomeTransition | null = null
      for (const t of sortedTransitions) {
        if (new Date(t.date).getTime() <= monthStart) {
          activeTransition = t
        } else {
          break
        }
      }
      if (activeTransition) {
        // Income delta as fraction of velocity adjustment
        const incomeDelta = activeTransition.monthlyIncome - baseIncome
        incomeAdj = incomeDelta
      }
    }
    cumulativeIncomeAdj += incomeAdj

    let onPlan = startValue + requiredVelocity * monthIndex
    const equityAdj = monthlyEquityGrowth * monthIndex
    const rentalAdj = totalMonthlyRentalIncome * monthIndex
    let projected = startValue + velocity * monthIndex + monthlyAssetGrowthRate * monthIndex + equityAdj + rentalAdj + cumulativeIncomeAdj
    let optimistic = startValue + velocity * 1.2 * monthIndex + monthlyAssetGrowthRate * 1.3 * monthIndex + equityAdj * 1.2 + rentalAdj * 1.1 + cumulativeIncomeAdj * 1.1
    let conservative = startValue + velocity * 0.8 * monthIndex + monthlyAssetGrowthRate * 0.7 * monthIndex + equityAdj * 0.6 + rentalAdj * 0.8 + cumulativeIncomeAdj * 0.8

    // Savings can't go below zero — floor projected values
    if (goal.metric === 'savings_amount') {
      projected = Math.max(0, projected)
      optimistic = Math.max(0, optimistic)
      conservative = Math.max(0, conservative)
    }

    // Debt can't go below zero
    if (goal.metric === 'debt_payoff' || goal.metric === 'debt_total') {
      projected = Math.max(0, projected)
      optimistic = Math.max(0, optimistic)
      conservative = Math.max(0, conservative)
      onPlan = Math.max(0, onPlan)
    }

    const point: ForecastPoint = {
      month: key,
      projected: round2(projected),
      optimistic: round2(optimistic),
      conservative: round2(conservative),
      onPlan: round2(onPlan),
      isHistorical,
    }

    if (isHistorical && snapshot) {
      point.actual = round2(extractMetricValue(snapshot, goal.metric))
    }

    points.push(point)
    current.setMonth(current.getMonth() + 1)
    monthIndex++
  }

  return points
}

function computeProjectedDate(
  currentValue: number,
  targetValue: number,
  velocity: number,
  now: Date,
): string | null {
  if (velocity <= 0) return null
  if (currentValue >= targetValue) return now.toISOString().slice(0, 10)

  const monthsNeeded = (targetValue - currentValue) / velocity
  const projected = new Date(now.getFullYear(), now.getMonth() + Math.ceil(monthsNeeded), 1)
  return projected.toISOString().slice(0, 10)
}

function computeConfidence(
  snapshots: MonthlySnapshotData[],
  velocity: number,
): { confidence: Forecast['confidence']; confidenceReason: string } {
  if (snapshots.length >= 6 && velocity > 0) {
    return { confidence: 'high', confidenceReason: '6+ months of consistent data' }
  }
  if (snapshots.length >= 3) {
    return { confidence: 'medium', confidenceReason: `Based on ${snapshots.length} months of data` }
  }
  if (snapshots.length > 0) {
    return { confidence: 'low', confidenceReason: 'Limited historical data — forecast will improve with more months' }
  }
  return { confidence: 'low', confidenceReason: 'No historical snapshots available' }
}

function generateTabSummaries(
  pace: Forecast['pace'],
  currentValue: number,
  goal: GoalTarget,
  velocity: number,
  projectedDate: string | null,
  debts: DebtForForecast[],
  budgets: BudgetSummaryForForecast,
  incomeTransitions?: IncomeTransition[],
): Forecast['tabSummaries'] {
  const progressPct = goal.targetValue !== goal.startValue
    ? Math.round(((currentValue - goal.startValue) / (goal.targetValue - goal.startValue)) * 100)
    : 0

  const paceLabel = pace === 'ahead' ? 'ahead of schedule' :
    pace === 'on_track' ? 'on track' :
    pace === 'behind' ? 'slightly behind' :
    pace === 'at_risk' ? 'at risk' : 'off track'

  // Build income transition context string
  const now = new Date()
  const futureTransitions = (incomeTransitions ?? []).filter((t) => new Date(t.date) > now)
  const nextTransition = futureTransitions.length > 0
    ? futureTransitions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]
    : null
  const transitionNote = nextTransition
    ? ` Upcoming income change: "${nextTransition.label}" in ${new Date(nextTransition.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} (${formatDollar(nextTransition.monthlyIncome)}/mo).`
    : ''

  const dashboard = `Goal is ${progressPct}% complete and ${paceLabel}. ${velocity > 0 ? `Averaging ${formatDollar(velocity)}/mo progress.` : 'No measurable progress yet.'}${transitionNote}`

  const budgetSurplus = budgets.projectedSurplus
  const budgetMsg = budgetSurplus > 0
    ? `Budget surplus of ${formatDollar(budgetSurplus)}/mo supports your goal.`
    : `Budget is tight — ${formatDollar(Math.abs(budgetSurplus))}/mo over budget.`

  const totalDebt = debts.reduce((s, d) => s + d.balance, 0)
  const debtMsg = debts.length > 0
    ? `${debts.length} debt${debts.length > 1 ? 's' : ''} totaling ${formatDollar(totalDebt)}. ${projectedDate ? `Payoff projected ${projectedDate}.` : 'Payoff date not projected.'}`
    : 'No outstanding debts tracked.'

  const annualPlan = budgets.annualSetAside > 0
    ? `Setting aside ${formatDollar(budgets.annualSetAside)}/mo for annual expenses.`
    : 'No annual expense set-asides configured.'

  const transactionsBase = velocity > 0
    ? `Your spending patterns support ${formatDollar(velocity)}/mo toward your goal.`
    : 'Review spending to find opportunities for goal progress.'
  const transactions = transactionsBase + transitionNote

  const monthlyReview = velocity > 0
    ? `You're averaging ${formatDollar(velocity)}/mo toward your goal (${paceLabel}). ${budgetSurplus > 0 ? `${formatDollar(budgetSurplus)}/mo surplus supports continued progress.` : 'Consider finding budget cuts to accelerate.'}`
    : `No measurable progress toward your goal yet. ${budgetSurplus > 0 ? `Your ${formatDollar(budgetSurplus)}/mo surplus is a foundation to build on.` : 'Review spending for opportunities.'}`

  const spending = velocity > 0
    ? `Current spending supports ${formatDollar(velocity)}/mo of goal progress. ${budgetSurplus > 0 ? 'Reducing flexible spending could accelerate your timeline.' : 'Spending is tight — small cuts make a big difference.'}`
    : 'Spending patterns are not currently contributing to goal progress. Look for categories where you can cut back.'

  const properties = velocity > 0
    ? `Your properties contribute to ${formatDollar(velocity)}/mo goal progress through equity growth and rental income.`
    : 'Track property values and rental income to see their impact on your goal.'

  return {
    dashboard,
    budgets: budgetMsg,
    debts: debtMsg,
    annualPlan,
    transactions,
    monthlyReview,
    spending,
    properties,
  }
}

/** Lightweight forecast computation for scenario diffs (skips scenarios to avoid recursion) */
function computeForecastLight(input: ForecastInput): Pick<Forecast, 'projectedDate' | 'monthlyVelocity' | 'requiredVelocity'> {
  const { goal, snapshots, debts, accounts, budgets, properties } = input
  const currentValue = computeCurrentValue(goal, snapshots, debts, accounts, properties)
  const snapshotVelocity = computeMonthlyVelocity(snapshots, goal.metric)
  const rentalIncomeAdj = (properties ?? []).reduce(
    (sum, prop) => sum + (prop.monthlyRentalIncome ?? 0), 0
  )
  let monthlyVelocity = snapshotVelocity + rentalIncomeAdj

  // For savings goals, use budget surplus when velocity is negative
  if (goal.metric === 'savings_amount' && monthlyVelocity < 0 && budgets.projectedSurplus > 0) {
    monthlyVelocity = budgets.projectedSurplus
  }
  const now = new Date()
  const targetDate = new Date(goal.targetDate)
  const monthsToTarget = monthsBetween(now, targetDate)
  const remaining = goal.targetValue - currentValue
  const requiredVelocity = monthsToTarget > 0 ? remaining / monthsToTarget : remaining
  const projectedDate = computeProjectedDate(currentValue, goal.targetValue, monthlyVelocity, now)

  return { projectedDate, monthlyVelocity, requiredVelocity }
}

function buildScenario(
  id: string,
  label: string,
  description: string,
  type: ForecastScenario['type'],
  baseline: Pick<Forecast, 'projectedDate' | 'monthlyVelocity'>,
  modifiedInput: ForecastInput,
): ForecastScenario {
  const modified = computeForecastLight(modifiedInput)
  const baselineDays = baseline.projectedDate ? daysBetween(new Date(), new Date(baseline.projectedDate)) : 0
  const modifiedDays = modified.projectedDate ? daysBetween(new Date(), new Date(modified.projectedDate)) : 0

  return {
    id,
    label,
    description,
    type,
    impact: {
      newProjectedDate: modified.projectedDate,
      daysSaved: baselineDays - modifiedDays,
      monthlyImpactOnTrueRemaining: round2(modified.monthlyVelocity - baseline.monthlyVelocity),
      monthlyImpactOnGoal: round2(modified.monthlyVelocity - baseline.monthlyVelocity),
      budgetCategoriesAffected: [],
      annualExpensesAffected: [],
    },
  }
}

function buildDebtExtraScenario(
  id: string,
  label: string,
  extra: number,
  debts: DebtForForecast[],
  baseline: Pick<Forecast, 'projectedDate' | 'monthlyVelocity'>,
  input: ForecastInput,
): ForecastScenario {
  // Apply extra to highest-rate debt
  const sorted = [...debts].sort((a, b) => b.interestRate - a.interestRate)
  const target = sorted[0]
  if (!target) {
    return {
      id,
      label,
      description: 'No debts to apply extra payments to',
      type: 'debt',
      impact: {
        newProjectedDate: baseline.projectedDate,
        daysSaved: 0,
        monthlyImpactOnTrueRemaining: 0,
        monthlyImpactOnGoal: 0,
        budgetCategoriesAffected: [],
        annualExpensesAffected: [],
      },
    }
  }

  // Estimate interest savings
  const monthlyRate = target.interestRate / 12
  const currentMonthlyInterest = target.balance * monthlyRate
  const basePrincipal = target.minimumPayment - currentMonthlyInterest
  const newPrincipal = basePrincipal + extra
  const baseMonths = basePrincipal > 0 ? Math.ceil(target.balance / basePrincipal) : 999
  const newMonths = newPrincipal > 0 ? Math.ceil(target.balance / newPrincipal) : 999
  const monthsSaved = Math.max(0, baseMonths - newMonths)
  const interestSaved = monthsSaved * currentMonthlyInterest

  return {
    id,
    label,
    description: `Add ${formatDollar(extra)}/mo extra to ${target.name} (${(target.interestRate * 100).toFixed(1)}%)`,
    type: 'debt',
    impact: {
      newProjectedDate: baseline.projectedDate,
      daysSaved: monthsSaved * 30,
      monthlyImpactOnTrueRemaining: round2(-extra),
      monthlyImpactOnGoal: round2(extra),
      totalInterestImpact: round2(-interestSaved),
      budgetCategoriesAffected: [],
      annualExpensesAffected: [],
    },
  }
}

// ── 3J: Forecast accuracy tracking ─────────────────────────────────────────

export function computeForecastAccuracy(
  timeline: ForecastPoint[],
): ForecastAccuracy {
  const points: ForecastAccuracyPoint[] = timeline
    .filter((p) => p.isHistorical && p.actual != null)
    .map((p) => {
      const delta = p.actual! - p.projected
      const deltaPct = p.projected !== 0 ? (delta / Math.abs(p.projected)) * 100 : 0
      return {
        month: p.month,
        projected: round2(p.projected),
        actual: round2(p.actual!),
        delta: round2(delta),
        deltaPct: round2(deltaPct),
      }
    })

  if (points.length === 0) {
    return {
      points: [],
      meanAbsoluteError: 0,
      meanAbsolutePctError: 0,
      bias: 0,
      rating: 'fair',
      ratingReason: 'No historical data to evaluate accuracy',
    }
  }

  const totalAbsError = points.reduce((s, p) => s + Math.abs(p.delta), 0)
  const totalAbsPctError = points.reduce((s, p) => s + Math.abs(p.deltaPct), 0)
  const totalBias = points.reduce((s, p) => s + p.delta, 0)

  const mae = round2(totalAbsError / points.length)
  const mape = round2(totalAbsPctError / points.length)
  const bias = round2(totalBias / points.length)

  let rating: ForecastAccuracy['rating']
  let ratingReason: string

  if (mape <= 5) {
    rating = 'excellent'
    ratingReason = `Average error of ${mape.toFixed(1)}% — forecast is highly accurate`
  } else if (mape <= 15) {
    rating = 'good'
    ratingReason = `Average error of ${mape.toFixed(1)}% — forecast is reasonably accurate`
  } else if (mape <= 30) {
    rating = 'fair'
    ratingReason = `Average error of ${mape.toFixed(1)}% — forecast may improve with more data`
  } else {
    rating = 'poor'
    ratingReason = `Average error of ${mape.toFixed(1)}% — consider revising your goal parameters`
  }

  return {
    points,
    meanAbsoluteError: mae,
    meanAbsolutePctError: mape,
    bias,
    rating,
    ratingReason,
  }
}

// ── Utility functions ───────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function formatDollar(amount: number): string {
  return `$${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
}

function monthsFromDate(start: Date, end: Date): number {
  return monthsBetween(start, end)
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}
