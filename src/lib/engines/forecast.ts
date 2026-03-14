/**
 * Forecast engine — pure computation, no database or framework imports.
 *
 * Projects goal progress forward using snapshot trends, asset growth,
 * property appreciation, and debt amortization. Generates scenarios
 * showing how changes affect the projected goal completion date.
 */

import { monthlyPayment, amortizationSchedule, piBreakdown } from './amortization'
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
  VelocityBreakdown,
  MonthlyBreakdownRow,
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

// ── 3D2: Anomaly detection (MAD-based) ──────────────────────────────────────

/**
 * Detect anomalous months using Median Absolute Deviation (MAD).
 * MAD is robust to the very outliers we're trying to detect (unlike stddev).
 * Returns indices of non-anomalous values and the filtered values.
 */
export function filterAnomalies(
  values: number[],
  threshold = 3,
): { filtered: number[]; anomalyIndices: number[] } {
  if (values.length < 3) return { filtered: values, anomalyIndices: [] }

  const sorted = [...values].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  const deviations = values.map((v) => Math.abs(v - median))
  const sortedDeviations = [...deviations].sort((a, b) => a - b)
  const mad = sortedDeviations[Math.floor(sortedDeviations.length / 2)]

  // If MAD is 0 (all values identical or nearly so), no anomalies
  if (mad === 0) return { filtered: values, anomalyIndices: [] }

  const anomalyIndices: number[] = []
  const filtered: number[] = []
  values.forEach((v, i) => {
    const modifiedZScore = Math.abs(v - median) / mad
    if (modifiedZScore > threshold) {
      anomalyIndices.push(i)
    } else {
      filtered.push(v)
    }
  })

  return { filtered, anomalyIndices }
}

// ── 3D3: Plan velocity (forward-looking from budget) ────────────────────────

/**
 * Forward-looking velocity from budget plan.
 * This is what the user's budget SAYS they should save each month.
 */
export function computePlanVelocity(input: ForecastInput): number {
  return input.budgets.projectedSurplus
}

// ── 3D4: Recent velocity (3-month anomaly-filtered) ─────────────────────────

/**
 * Recent velocity from last 3 months, with anomaly filtering.
 * Returns null if insufficient non-anomalous data.
 */
export function computeRecentVelocity(
  snapshots: MonthlySnapshotData[],
  metric: GoalMetric,
): number | null {
  const recent = snapshots.slice(-3)
  if (recent.length < 2) return null

  const values = recent.map((s) => extractMetricValue(s, metric))
  const { filtered } = filterAnomalies(values)

  if (filtered.length < 2) return null

  // Simple average (no weighting — short window)
  return filtered.reduce((sum, v) => sum + v, 0) / filtered.length
}

// ── 3D5: Blended velocity (3-signal) ────────────────────────────────────────

/**
 * Blended velocity from three signals.
 * Shifts from plan-based (new users) to data-based (mature users).
 */
export function computeBlendedVelocity(
  input: ForecastInput,
  snapshotVelocity: number,
  snapshots: MonthlySnapshotData[],
): { velocity: number; breakdown: VelocityBreakdown } {
  const planVelocity = computePlanVelocity(input)
  const recentVelocity = computeRecentVelocity(snapshots, input.goal.metric)
  const trendVelocity = snapshotVelocity

  // Filter anomalies from all snapshots for the anomaly report
  const allValues = snapshots.map((s) => extractMetricValue(s, input.goal.metric))
  const { anomalyIndices } = filterAnomalies(allValues)

  const monthsOfData = snapshots.length
  let planWeight: number, recentWeight: number, trendWeight: number

  if (monthsOfData < 3) {
    // New user: trust the plan entirely
    planWeight = 1.0; recentWeight = 0; trendWeight = 0
  } else if (monthsOfData < 6) {
    // Building history: blend plan + recent
    planWeight = 0.6; recentWeight = 0.4; trendWeight = 0
  } else if (monthsOfData < 12) {
    // Solid history: three-way blend
    planWeight = 0.3; recentWeight = 0.3; trendWeight = 0.4
  } else {
    // Mature user: trust history most
    planWeight = 0.2; recentWeight = 0.2; trendWeight = 0.6
  }

  // If recent velocity is null (not enough clean data), redistribute weight to plan
  if (recentVelocity === null) {
    planWeight += recentWeight
    recentWeight = 0
  }

  const blended = planWeight * planVelocity
    + recentWeight * (recentVelocity ?? 0)
    + trendWeight * trendVelocity

  return {
    velocity: blended,
    breakdown: {
      plan: { value: planVelocity, weight: planWeight },
      recent: { value: recentVelocity, weight: recentWeight },
      trend: { value: trendVelocity, weight: trendWeight },
      anomalyCount: anomalyIndices.length,
      anomalyMonths: anomalyIndices
        .map((i) => snapshots[i]?.month)
        .filter((m): m is string => m != null),
      monthsOfData,
    },
  }
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

  // 2. Compute blended velocity from 3 signals (plan + recent + trend)
  const rawSnapshotVelocity = computeMonthlyVelocity(snapshots, goal.metric)
  const { velocity: blendedVelocity, breakdown: velocityBreakdown } =
    computeBlendedVelocity(input, rawSnapshotVelocity, snapshots)

  // 2b. Adjust velocity for rental income (snapshots may not capture it)
  const rentalIncomeAdj = (properties ?? []).reduce(
    (sum, prop) => sum + (prop.monthlyRentalIncome ?? 0), 0
  )
  const monthlyVelocity = blendedVelocity + rentalIncomeAdj

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

  // 5. Project timeline — use blended velocity (without rental, since
  //    projectTimeline adds rental internally) so the chart reflects the blend
  const timelineVelocity = blendedVelocity
  const timeline = projectTimeline(goal, snapshots, timelineVelocity, requiredVelocity, accounts, properties, budgets, input.incomeTransitions)

  // 6. Compute projected date
  // When income transitions exist, derive from the timeline (which accounts for
  // step changes) instead of the constant-velocity estimate
  const hasTransitions = (input.incomeTransitions ?? []).length > 0
  let projectedDate: string | null
  if (hasTransitions) {
    // Walk the timeline to find the first future month where projected >= target
    projectedDate = null
    for (const point of timeline) {
      if (!point.isHistorical && point.projected >= goal.targetValue) {
        // Convert YYYY-MM key to ISO date
        projectedDate = `${point.month}-01`
        break
      }
    }
  } else {
    projectedDate = computeProjectedDate(currentValue, goal.targetValue, monthlyVelocity, now)
  }

  // 7. Projected value at target date (uses rental-adjusted velocity)
  // When income transitions exist, read from timeline at target month for accuracy
  let projectedValue: number
  if (hasTransitions && monthsToTarget > 0) {
    // Find the timeline point closest to the target date
    const targetKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`
    const targetPoint = timeline.find((p) => p.month === targetKey)
    projectedValue = targetPoint?.projected ?? (currentValue + monthlyVelocity * Math.max(0, monthsToTarget))
  } else {
    projectedValue = currentValue + monthlyVelocity * Math.max(0, monthsToTarget)
  }

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

  // 9. Generate scenarios (skip when called recursively to prevent stack overflow)
  const scenarios = input._skipScenarios ? [] : generateDefaultScenarios(input)

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
    velocityBreakdown,
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
  const modified = computeForecast({ ...modifiedInput, _skipScenarios: true })

  const baselineDays = baselineForecast.projectedDate
    ? daysBetween(new Date(), new Date(baselineForecast.projectedDate))
    : 0
  const modifiedDays = modified.projectedDate
    ? daysBetween(new Date(), new Date(modified.projectedDate))
    : 0

  return {
    newProjectedDate: modified.projectedDate,
    daysSaved: baselineDays - modifiedDays,
    makesGoalAchievable: !baselineForecast.projectedDate && !!modified.projectedDate,
    velocityChange: round2(modified.monthlyVelocity - baselineForecast.monthlyVelocity),
    monthlyImpactOnTrueRemaining: round2(modified.monthlyVelocity - baselineForecast.monthlyVelocity),
    monthlyImpactOnGoal: round2(modified.requiredVelocity - baselineForecast.requiredVelocity),
    budgetCategoriesAffected: [],
    annualExpensesAffected: [],
  }
}

// ── 3I: Generate smart recommendation ───────────────────────────────────────
// Produces ONE data-driven scenario recommendation based on goal archetype
// and the user's real financial data. Users build custom scenarios separately.

export function generateDefaultScenarios(input: ForecastInput): ForecastScenario[] {
  const recommendation = generateSmartRecommendation(input)
  return recommendation ? [recommendation] : []
}

export function generateSmartRecommendation(input: ForecastInput): ForecastScenario | null {
  const { goal, debts, accounts, budgets } = input
  const archetype = goal.archetype ?? 'save_more'
  const baseline = computeForecast({ ...input, _skipScenarios: true })

  // Candidate scenarios scored by impact
  interface Candidate {
    scenario: ForecastScenario
    score: number
  }
  const candidates: Candidate[] = []

  // ── Candidate: Cut flexible spending 10% ──
  if (budgets.flexibleTotal > 0) {
    const cutAmount = round2(budgets.flexibleTotal * 0.1)
    const s = buildScenario(
      'smart-cut-flexible',
      `Cut flexible spending ${formatDollar(cutAmount)}/mo`,
      `Reduce flexible budget by 10% — saves ${formatDollar(cutAmount)}/mo`,
      'cut',
      baseline,
      {
        ...input,
        budgets: {
          ...budgets,
          flexibleTotal: budgets.flexibleTotal - cutAmount,
          projectedSurplus: budgets.projectedSurplus + cutAmount,
        },
      },
    )
    candidates.push({ scenario: s, score: s.impact.daysSaved + cutAmount * 12 })
  }

  // ── Candidate: Extra debt payment on highest-rate debt ──
  const highRateDebts = [...debts].sort((a, b) => b.interestRate - a.interestRate)
  if (highRateDebts.length > 0 && highRateDebts[0].interestRate > 0.04) {
    const target = highRateDebts[0]
    // Size the extra payment to ~5% of surplus, clamped to $50-$500
    const surplusBasedExtra = Math.round(budgets.projectedSurplus * 0.05 / 50) * 50
    const extra = Math.max(50, Math.min(500, surplusBasedExtra || 100))
    const s = buildDebtExtraScenario(
      'smart-extra-debt',
      `Add ${formatDollar(extra)}/mo to ${target.name}`,
      extra,
      debts,
      baseline,
      input,
    )
    candidates.push({ scenario: s, score: s.impact.daysSaved + extra * 12 })
  }

  // ── Candidate: Refinance high-rate mortgage ──
  if (archetype === 'pay_off_debt' || archetype === 'build_wealth') {
    const refiCandidates = debts.filter((d) => d.interestRate > 0.055 && d.type === 'MORTGAGE')
    for (const debt of refiCandidates.slice(0, 1)) {
      const newRate = round2(debt.interestRate - 0.015) // assume 1.5% reduction
      const newPmt = monthlyPayment(debt.balance, newRate, 360)
      const oldPmt = debt.minimumPayment
      const savings = oldPmt - newPmt
      if (savings > 20) {
        const refiInput: ForecastInput = {
          ...input,
          debts: debts.map((d) =>
            d.id === debt.id ? { ...d, interestRate: newRate, minimumPayment: newPmt } : d,
          ),
          budgets: {
            ...budgets,
            fixedTotal: budgets.fixedTotal - oldPmt + newPmt,
            totalBudgeted: budgets.totalBudgeted - oldPmt + newPmt,
            projectedSurplus: budgets.projectedSurplus + savings,
          },
        }
        const s = buildScenario(
          `smart-refinance-${debt.id}`,
          `Refinance ${debt.name}`,
          `Refinance from ${(debt.interestRate * 100).toFixed(1)}% to ${(newRate * 100).toFixed(1)}% — saves ${formatDollar(savings)}/mo`,
          'refinance',
          baseline,
          refiInput,
        )
        candidates.push({ scenario: s, score: s.impact.daysSaved + savings * 24 })
      }
    }
  }

  // ── Candidate: Increase savings rate by 5% (wealth/savings goals) ──
  if ((archetype === 'build_wealth' || archetype === 'save_more') && budgets.expectedMonthlyIncome > 0) {
    const additional = round2(budgets.expectedMonthlyIncome * 0.05)
    const s = buildScenario(
      'smart-save-more',
      `Save an extra ${formatDollar(additional)}/mo`,
      `Increase savings rate by 5% of income`,
      'income',
      baseline,
      {
        ...input,
        budgets: {
          ...budgets,
          projectedSurplus: budgets.projectedSurplus + additional,
        },
      },
    )
    candidates.push({ scenario: s, score: s.impact.daysSaved + additional * 12 })
  }

  // ── Candidate: Move idle cash to HYSA ──
  const cashAccounts = accounts.filter((a) => a.assetClass === 'cash' && a.balance > 2000)
  if (cashAccounts.length > 0) {
    const cashTotal = cashAccounts.reduce((s, a) => s + a.balance, 0)
    const moveAmount = cashTotal - 1000
    if (moveAmount > 500) {
      const monthlyInterest = round2(moveAmount * 0.045 / 12)
      const s: ForecastScenario = {
        id: 'smart-hysa',
        label: `Move ${formatDollar(moveAmount)} to high-yield savings`,
        description: `Earn ~${formatDollar(monthlyInterest)}/mo on idle cash at 4.5% APY`,
        type: 'investment',
        recommended: true,
        impact: {
          newProjectedDate: baseline.projectedDate,
          daysSaved: 0,
          monthlyImpactOnTrueRemaining: 0,
          monthlyImpactOnGoal: monthlyInterest,
          budgetCategoriesAffected: [],
          annualExpensesAffected: [],
        },
      }
      candidates.push({ scenario: s, score: monthlyInterest * 12 })
    }
  }

  if (candidates.length === 0) return null

  // Pick the highest-scoring candidate
  candidates.sort((a, b) => b.score - a.score)
  const best = candidates[0].scenario
  best.recommended = true
  return best
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

  // Compute months early/late based on velocity vs required
  const monthsDelta = effectiveRequired > 0 && effectiveVelocity > 0
    ? Math.round(monthsToTarget - (goal.targetValue - currentValue) / effectiveVelocity)
    : 0
  const monthsEarlyLate = monthsDelta > 0
    ? `${monthsDelta} month${monthsDelta !== 1 ? 's' : ''} early`
    : monthsDelta < 0
    ? `${Math.abs(monthsDelta)} month${Math.abs(monthsDelta) !== 1 ? 's' : ''} late`
    : null

  if (ratio > 1.1) {
    pace = 'ahead'
    const monthsAhead = monthsToTarget > 0 ? (currentValue - goal.startValue) / effectiveRequired - (monthsFromDate(new Date(goal.startDate), new Date())) : 0
    daysAhead = Math.round(monthsAhead * 30)
    paceDetail = monthsEarlyLate
      ? `Progressing ${((ratio - 1) * 100).toFixed(0)}% faster than needed — on pace to finish ${monthsEarlyLate}`
      : `Progressing ${((ratio - 1) * 100).toFixed(0)}% faster than needed`
  } else if (ratio >= 0.9) {
    pace = 'on_track'
    paceDetail = 'On track to reach your goal on time'
  } else if (ratio >= 0.7) {
    pace = 'behind'
    paceDetail = monthsEarlyLate
      ? `${((1 - ratio) * 100).toFixed(0)}% below the required pace — projected ${monthsEarlyLate}`
      : `${((1 - ratio) * 100).toFixed(0)}% below the required pace`
  } else if (ratio >= 0.5) {
    pace = 'at_risk'
    paceDetail = monthsEarlyLate
      ? `Significantly behind — projected ${monthsEarlyLate}`
      : `Significantly behind — ${((1 - ratio) * 100).toFixed(0)}% below required pace`
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

  // Compute months early/late for display
  const now = new Date()
  const targetDate = new Date(goal.targetDate)
  let earlyLateNote = ''
  if (projectedDate) {
    const projDate = new Date(projectedDate)
    const monthsDiff = monthsBetween(projDate, targetDate)
    if (Math.abs(monthsDiff) >= 1) {
      const absMonths = Math.round(Math.abs(monthsDiff))
      earlyLateNote = monthsDiff > 0
        ? ` Projected to finish ${absMonths} month${absMonths !== 1 ? 's' : ''} early.`
        : ` Projected to finish ${absMonths} month${absMonths !== 1 ? 's' : ''} late.`
    }
  }

  // Build income transition context string
  const futureTransitions = (incomeTransitions ?? []).filter((t) => new Date(t.date) > now)
  const nextTransition = futureTransitions.length > 0
    ? futureTransitions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]
    : null
  const transitionNote = nextTransition
    ? ` Upcoming income change: "${nextTransition.label}" in ${new Date(nextTransition.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} (${formatDollar(nextTransition.monthlyIncome)}/mo).`
    : ''

  const dashboard = `Goal is ${progressPct}% complete and ${paceLabel}. ${velocity > 0 ? `Averaging ${formatDollar(velocity)}/mo progress.` : 'No measurable progress yet.'}${earlyLateNote}${transitionNote}`

  const budgetSurplus = budgets.projectedSurplus
  const budgetMsg = budgetSurplus > 0
    ? `Budget surplus of ${formatDollar(budgetSurplus)}/mo supports your goal.`
    : `Budget is tight — ${formatDollar(Math.abs(budgetSurplus))}/mo over budget.`

  const totalDebt = debts.reduce((s, d) => s + d.balance, 0)
  let debtMsg: string
  if (debts.length === 0) {
    debtMsg = 'No outstanding debts tracked.'
  } else {
    // Compute actual payoff date from amortization, not goal projected date
    let latestPayoff: Date | null = null
    const now = new Date()
    for (const d of debts) {
      if (d.balance <= 0 || d.minimumPayment <= 0) continue
      const pi = piBreakdown(d.balance, d.interestRate, d.minimumPayment)
      if (pi.monthsRemaining != null && pi.monthsRemaining > 0) {
        const payoff = new Date(now.getFullYear(), now.getMonth() + pi.monthsRemaining, 1)
        if (!latestPayoff || payoff > latestPayoff) latestPayoff = payoff
      }
    }
    const payoffLabel = latestPayoff
      ? `Payoff projected ${latestPayoff.toISOString().slice(0, 7)}.`
      : 'Payoff date not projected.'
    debtMsg = `${debts.length} debt${debts.length > 1 ? 's' : ''} totaling ${formatDollar(totalDebt)}. ${payoffLabel}`
  }

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

// ── 3G2: Debt payoff acceleration with income transitions ──────────────────

export interface DebtPayoffAcceleration {
  debtName: string
  debtId: string
  balance: number
  /** Payoff date without income transitions */
  baselinePayoffDate: string | null
  baselineMonthsRemaining: number
  baselineTotalInterest: number
  /** Payoff date with income transitions (extra surplus goes to debt) */
  acceleratedPayoffDate: string | null
  acceleratedMonthsRemaining: number
  acceleratedTotalInterest: number
  /** Savings from acceleration */
  monthsSaved: number
  interestSaved: number
}

/**
 * Compute how income transitions affect debt payoff timelines.
 * For each debt, projects payoff with and without the extra surplus
 * from income transitions applied as extra payments.
 */
export function computeDebtPayoffAcceleration(
  debts: DebtForForecast[],
  currentMonthlyExpenses: number,
  currentMonthlyIncome: number,
  incomeTransitions: IncomeTransition[],
  debtPaymentRatio: number = 0.5, // fraction of surplus applied to debt
): DebtPayoffAcceleration[] {
  if (debts.length === 0 || incomeTransitions.length === 0) return []

  const sortedTransitions = [...incomeTransitions]
    .filter((t) => new Date(t.date) > new Date() && t.monthlyIncome > 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  if (sortedTransitions.length === 0) return []

  const results: DebtPayoffAcceleration[] = []
  const now = new Date()

  for (const debt of debts) {
    if (debt.balance <= 0 || debt.minimumPayment <= 0) continue

    // Baseline: payoff at minimum payments
    const baselinePI = piBreakdown(debt.balance, debt.interestRate, debt.minimumPayment)
    const baselineMonths = baselinePI.monthsRemaining ?? 360
    const baselineDate = new Date(now)
    baselineDate.setMonth(baselineDate.getMonth() + baselineMonths)
    const baselineTotalInterest = baselineMonths > 0
      ? debt.minimumPayment * baselineMonths - debt.balance
      : 0

    // Accelerated: walk month by month, applying extra surplus after transitions
    let remaining = debt.balance
    let totalInterest = 0
    let month = 0
    const maxMonths = 600 // 50 year cap

    while (remaining > 0 && month < maxMonths) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() + month, 1)

      // Find active income for this month
      let activeIncome = currentMonthlyIncome
      for (const t of sortedTransitions) {
        if (new Date(t.date).getTime() <= monthDate.getTime()) {
          activeIncome = t.monthlyIncome
        } else {
          break
        }
      }

      // Extra payment from surplus
      const surplus = Math.max(0, activeIncome - currentMonthlyExpenses - debt.minimumPayment)
      const extraPayment = surplus * debtPaymentRatio

      // Monthly interest
      const monthlyInterest = remaining * (debt.interestRate / 12)
      totalInterest += monthlyInterest

      // Total payment this month
      const totalPayment = debt.minimumPayment + extraPayment
      const principalPayment = totalPayment - monthlyInterest
      remaining = Math.max(0, remaining - principalPayment)
      month++
    }

    const acceleratedDate = new Date(now)
    acceleratedDate.setMonth(acceleratedDate.getMonth() + month)

    results.push({
      debtName: debt.name,
      debtId: debt.id,
      balance: debt.balance,
      baselinePayoffDate: baselineMonths < 360 ? baselineDate.toISOString().slice(0, 10) : null,
      baselineMonthsRemaining: baselineMonths,
      baselineTotalInterest: round2(Math.max(0, baselineTotalInterest)),
      acceleratedPayoffDate: month < maxMonths ? acceleratedDate.toISOString().slice(0, 10) : null,
      acceleratedMonthsRemaining: month,
      acceleratedTotalInterest: round2(Math.max(0, totalInterest)),
      monthsSaved: Math.max(0, baselineMonths - month),
      interestSaved: round2(Math.max(0, baselineTotalInterest - totalInterest)),
    })
  }

  return results
}

/** Lightweight forecast computation for scenario diffs (skips scenarios to avoid recursion) */
function computeForecastLight(input: ForecastInput): Pick<Forecast, 'projectedDate' | 'monthlyVelocity' | 'requiredVelocity'> {
  const { goal, snapshots, debts, accounts, properties } = input
  const currentValue = computeCurrentValue(goal, snapshots, debts, accounts, properties)

  // Use blended velocity model (same as computeForecast)
  const rawSnapshotVelocity = computeMonthlyVelocity(snapshots, goal.metric)
  const { velocity: blendedVelocity } = computeBlendedVelocity(input, rawSnapshotVelocity, snapshots)

  const rentalIncomeAdj = (properties ?? []).reduce(
    (sum, prop) => sum + (prop.monthlyRentalIncome ?? 0), 0
  )
  const monthlyVelocity = blendedVelocity + rentalIncomeAdj

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
  baseline: Forecast,
  modifiedInput: ForecastInput,
): ForecastScenario {
  const modified = computeForecast({ ...modifiedInput, _skipScenarios: true })
  const baselineDays = baseline.projectedDate ? daysBetween(new Date(), new Date(baseline.projectedDate)) : 0
  const modifiedDays = modified.projectedDate ? daysBetween(new Date(), new Date(modified.projectedDate)) : 0

  // Build monthly breakdown (capped at 36 months)
  const startValue = modifiedInput.goal?.startValue ?? 0
  const maxLen = Math.min(36, Math.max(baseline.timeline.length, modified.timeline.length))
  const monthlyBreakdown: MonthlyBreakdownRow[] = []
  let cumulative = 0

  for (let i = 0; i < maxLen; i++) {
    const basePoint = baseline.timeline[i] ?? baseline.timeline[baseline.timeline.length - 1]
    const scenarioPoint = modified.timeline[i] ?? modified.timeline[modified.timeline.length - 1]
    const baseCurrent = basePoint?.projected ?? 0
    const scenarioCurrent = scenarioPoint?.projected ?? 0
    const basePrev = i > 0 ? (baseline.timeline[i - 1]?.projected ?? 0) : startValue
    const scenarioPrev = i > 0 ? (modified.timeline[i - 1]?.projected ?? 0) : startValue
    const baseGain = baseCurrent - basePrev
    const scenarioGain = scenarioCurrent - scenarioPrev
    const delta = scenarioGain - baseGain
    cumulative += delta

    monthlyBreakdown.push({
      month: (baseline.timeline[i] ?? modified.timeline[i])?.month ?? '',
      baselineValue: round2(baseGain),
      scenarioValue: round2(scenarioGain),
      delta: round2(delta),
      cumulativeImpact: round2(cumulative),
    })
  }

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
    scenarioTimeline: modified.timeline,
    monthlyBreakdown,
    baselineProjectedDate: baseline.projectedDate ?? null,
    scenarioProjectedDate: modified.projectedDate ?? null,
  }
}

function buildDebtExtraScenario(
  id: string,
  label: string,
  extra: number,
  debts: DebtForForecast[],
  baseline: Forecast,
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

  // Build modified input with extra payment
  const modifiedInput: ForecastInput = {
    ...input,
    debts: input.debts.map((d) =>
      d.id === target.id ? { ...d, minimumPayment: d.minimumPayment + extra } : d
    ),
    budgets: {
      ...input.budgets,
      projectedSurplus: input.budgets.projectedSurplus - extra,
    },
  }

  return buildScenario(
    id,
    label,
    `Add ${formatDollar(extra)}/mo extra to ${target.name} (${(target.interestRate * 100).toFixed(1)}%)`,
    'debt',
    baseline,
    modifiedInput,
  )
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
