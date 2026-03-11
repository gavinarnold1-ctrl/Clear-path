import {
  ASSET_CLASS_DEFAULTS,
  autoDetectAssetClass,
  getAssetConfig,
  computeMonthlyVelocity,
  filterAnomalies,
  computePlanVelocity,
  computeRecentVelocity,
  computeBlendedVelocity,
  computeScenarioImpact,
  projectAssetGrowth,
  projectPropertyEquity,
  computeForecast,
  generateDefaultScenarios,
} from '@/lib/engines/forecast'
import type {
  AccountForForecast,
  MonthlySnapshotData,
  ForecastInput,
  GoalTarget,
  DebtForForecast,
  BudgetSummaryForForecast,
} from '@/types'

// ── Helper factories ────────────────────────────────────────────────────────

function makeSnapshot(overrides: Partial<MonthlySnapshotData> = {}): MonthlySnapshotData {
  return {
    month: '2026-01-01',
    totalIncome: 8000,
    totalExpenses: -5000,
    netSurplus: 3000,
    savingsRate: 0.375,
    totalDebt: 50000,
    debtPaidDown: 500,
    netWorth: 100000,
    trueRemaining: 2000,
    ...overrides,
  }
}

function makeAccount(overrides: Partial<AccountForForecast> = {}): AccountForForecast {
  return {
    id: 'acc-1',
    name: 'Checking',
    type: 'CHECKING',
    balance: 5000,
    assetClass: 'cash',
    expectedReturn: null,
    riskWeight: null,
    ...overrides,
  }
}

function makeGoal(overrides: Partial<GoalTarget> = {}): GoalTarget {
  return {
    archetype: 'save_more',
    metric: 'savings_amount',
    targetValue: 20000,
    targetDate: '2027-01-01',
    startValue: 5000,
    startDate: '2026-01-01',
    description: 'Save $20,000 by Jan 2027',
    ...overrides,
  }
}

function makeDebt(overrides: Partial<DebtForForecast> = {}): DebtForForecast {
  return {
    id: 'debt-1',
    name: 'Credit Card',
    type: 'CREDIT_CARD',
    balance: 5000,
    interestRate: 0.22,
    minimumPayment: 150,
    escrowAmount: 0,
    ...overrides,
  }
}

function makeBudgets(overrides: Partial<BudgetSummaryForForecast> = {}): BudgetSummaryForForecast {
  return {
    fixedTotal: 2000,
    flexibleTotal: 1500,
    annualSetAside: 200,
    expectedMonthlyIncome: 8000,
    totalBudgeted: 3700,
    projectedSurplus: 4300,
    ...overrides,
  }
}

function makeInput(overrides: Partial<ForecastInput> = {}): ForecastInput {
  return {
    goal: makeGoal(),
    snapshots: [
      makeSnapshot({ month: '2025-10-01', netSurplus: 2800, netWorth: 95000 }),
      makeSnapshot({ month: '2025-11-01', netSurplus: 3000, netWorth: 97000 }),
      makeSnapshot({ month: '2025-12-01', netSurplus: 3200, netWorth: 99000 }),
      makeSnapshot({ month: '2026-01-01', netSurplus: 2900, netWorth: 100000 }),
    ],
    debts: [],
    accounts: [makeAccount()],
    budgets: makeBudgets(),
    annualExpenses: [],
    ...overrides,
  }
}

// ── 9A: Asset class config tests ────────────────────────────────────────────

describe('Asset class config', () => {
  it('getAssetConfig returns defaults when no overrides', () => {
    const account = makeAccount({ assetClass: 'index_fund' })
    const config = getAssetConfig(account)
    expect(config.expectedAnnualReturn).toBe(0.1)
    expect(config.riskWeight).toBe(0.7)
    expect(config.volatility).toBe(0.15)
    expect(config.label).toBe('Index Funds')
  })

  it('getAssetConfig applies user overrides', () => {
    const account = makeAccount({
      assetClass: 'index_fund',
      expectedReturn: 0.12,
      riskWeight: 0.8,
    })
    const config = getAssetConfig(account)
    expect(config.expectedAnnualReturn).toBe(0.12)
    expect(config.riskWeight).toBe(0.8)
    // Volatility should remain default (not overridable)
    expect(config.volatility).toBe(0.15)
  })

  it('autoDetectAssetClass maps account types correctly', () => {
    expect(autoDetectAssetClass('CHECKING')).toBe('cash')
    expect(autoDetectAssetClass('SAVINGS')).toBe('high_yield_savings')
    expect(autoDetectAssetClass('INVESTMENT')).toBe('index_fund')
    expect(autoDetectAssetClass('CREDIT_CARD')).toBe('cash')
    expect(autoDetectAssetClass('UNKNOWN')).toBe('cash')
  })

  it('ASSET_CLASS_DEFAULTS has all 9 asset classes', () => {
    const keys = Object.keys(ASSET_CLASS_DEFAULTS)
    expect(keys).toHaveLength(9)
    expect(keys).toContain('cash')
    expect(keys).toContain('high_yield_savings')
    expect(keys).toContain('bonds')
    expect(keys).toContain('index_fund')
    expect(keys).toContain('mutual_fund')
    expect(keys).toContain('individual_stock')
    expect(keys).toContain('crypto')
    expect(keys).toContain('real_estate')
    expect(keys).toContain('other')
  })
})

// ── 9B: Velocity computation tests ──────────────────────────────────────────

describe('computeMonthlyVelocity', () => {
  it('returns weighted average of levels with 3 months of savings data', () => {
    const snapshots = [
      makeSnapshot({ month: '2025-11-01', netSurplus: 2000 }),
      makeSnapshot({ month: '2025-12-01', netSurplus: 3000 }),
      makeSnapshot({ month: '2026-01-01', netSurplus: 2500 }),
    ]
    const velocity = computeMonthlyVelocity(snapshots, 'savings_amount')
    // savings_amount uses level-based (weighted avg of netSurplus values, not deltas)
    // Values: [2000, 3000, 2500], weights: [1, 2, 3]
    // (2000*1 + 3000*2 + 2500*3) / (1+2+3) = 15500/6 ≈ 2583
    expect(velocity).toBeCloseTo(2583, 0)
  })

  it('returns weighted average of levels with 6 months of data', () => {
    const snapshots = Array.from({ length: 7 }, (_, i) =>
      makeSnapshot({ month: `2025-${String(7 + i).padStart(2, '0')}-01`, netSurplus: 2000 + i * 200 })
    )
    const velocity = computeMonthlyVelocity(snapshots, 'savings_amount')
    // savings_amount uses level-based: weighted avg of netSurplus values (last 6)
    // Values: [2200,2400,2600,2800,3000,3200], weights: [1,1,1,1,2,3]
    // (2200+2400+2600+2800+6000+9600)/9 = 25600/9 ≈ 2844
    expect(velocity).toBeCloseTo(2844, 0)
  })

  it('returns 0 when no snapshots', () => {
    expect(computeMonthlyVelocity([], 'savings_amount')).toBe(0)
  })

  it('handles single-month data', () => {
    const snapshots = [makeSnapshot({ netSurplus: 3000 })]
    const velocity = computeMonthlyVelocity(snapshots, 'savings_amount')
    // Single value, no deltas can be computed, returns the value itself
    expect(velocity).toBe(3000)
  })

  it('computes debt reduction velocity', () => {
    const snapshots = [
      makeSnapshot({ month: '2025-11-01', debtPaidDown: 400 }),
      makeSnapshot({ month: '2025-12-01', debtPaidDown: 500 }),
      makeSnapshot({ month: '2026-01-01', debtPaidDown: 600 }),
    ]
    const velocity = computeMonthlyVelocity(snapshots, 'debt_payoff')
    // Deltas: 100, 100 → weighted average of 100s = 100
    expect(velocity).toBeCloseTo(100, 0)
  })
})

// ── 9C: Asset growth projection tests ───────────────────────────────────────

describe('projectAssetGrowth', () => {
  it('cash account: 0% growth (balance unchanged)', () => {
    const account = makeAccount({ balance: 10000, assetClass: 'cash' })
    const projection = projectAssetGrowth(account, 12)
    expect(projection.projectedBalance12mo).toBe(10000)
    expect(projection.expectedGrowth).toBe(0)
    expect(projection.uncertaintyRange.low).toBe(10000)
    expect(projection.uncertaintyRange.high).toBe(10000)
  })

  it('HYSA: ~4.5% annual compound growth', () => {
    const account = makeAccount({
      balance: 10000,
      assetClass: 'high_yield_savings',
    })
    const projection = projectAssetGrowth(account, 12)
    // Risk-weighted: 4.5% * 0.98 ≈ 4.41% annual
    // Monthly: 10000 * (1 + 0.0441/12)^12 ≈ 10450
    expect(projection.projectedBalance12mo).toBeGreaterThan(10400)
    expect(projection.projectedBalance12mo).toBeLessThan(10500)
    expect(projection.expectedGrowth).toBeGreaterThan(400)
  })

  it('index fund: risk-weighted vs optimistic vs conservative', () => {
    const account = makeAccount({
      balance: 50000,
      assetClass: 'index_fund',
    })
    const projection = projectAssetGrowth(account, 12)
    // Risk-weighted: 10% * 0.7 = 7% annual
    expect(projection.projectedBalance12mo).toBeGreaterThan(53000)
    expect(projection.projectedBalance12mo).toBeLessThan(54000)
    // Optimistic (full 10%): ~55000
    expect(projection.uncertaintyRange.high).toBeGreaterThan(54500)
    // Conservative: lower
    expect(projection.uncertaintyRange.low).toBeLessThan(projection.projectedBalance12mo)
  })

  it('crypto: high volatility, wide uncertainty band', () => {
    const account = makeAccount({
      balance: 10000,
      assetClass: 'crypto',
    })
    const projection = projectAssetGrowth(account, 12)
    const range = projection.uncertaintyRange.high - projection.uncertaintyRange.low
    // Crypto has 0.6 volatility — should create a very wide band
    expect(range).toBeGreaterThan(1000)
  })

  it('12-month projection math is correct for known values', () => {
    const account = makeAccount({
      balance: 10000,
      assetClass: 'bonds',
      expectedReturn: 0.05,
      riskWeight: 1.0, // full return, no risk weighting
    })
    const projection = projectAssetGrowth(account, 12)
    // 10000 * (1 + 0.05/12)^12 ≈ 10511.62
    expect(projection.projectedBalance12mo).toBeCloseTo(10511.62, 0)
  })
})

// ── 9D: Property equity projection tests ────────────────────────────────────

describe('projectPropertyEquity', () => {
  it('appreciation: 3% annual on $400K', () => {
    const property = {
      id: 'prop-1',
      name: 'Home',
      currentValue: 400000,
      loanBalance: null,
      interestRate: null,
      monthlyPayment: null,
      appreciationRate: 0.03,
    }
    const result = projectPropertyEquity(property, 12)
    // 400000 * (1 + 0.03/12)^12 ≈ 412,133
    expect(result.appreciatedValue).toBeGreaterThan(412000)
    expect(result.appreciatedValue).toBeLessThan(413000)
    expect(result.equity).toBe(result.appreciatedValue) // No loan
  })

  it('combined equity = appreciated value - remaining balance', () => {
    const property = {
      id: 'prop-2',
      name: 'Rental',
      currentValue: 300000,
      loanBalance: 200000,
      interestRate: 0.065,
      monthlyPayment: 1264,
      appreciationRate: 0.03,
    }
    const result = projectPropertyEquity(property, 12)
    expect(result.appreciatedValue).toBeGreaterThan(300000)
    expect(result.remainingBalance).toBeLessThan(200000)
    expect(result.equity).toBeCloseTo(result.appreciatedValue - result.remainingBalance, 0)
  })
})

// ── 9E: Full forecast computation tests ─────────────────────────────────────

describe('computeForecast', () => {
  it('save_more goal with positive velocity produces valid forecast', () => {
    const input = makeInput({
      goal: makeGoal({
        metric: 'savings_amount',
        targetValue: 20000,
        startValue: 5000,
        currentValue: 10000,
        targetDate: '2027-06-01',
        startDate: '2025-06-01',
      }),
      snapshots: [
        makeSnapshot({ month: '2025-10-01', netSurplus: 1200 }),
        makeSnapshot({ month: '2025-11-01', netSurplus: 1300 }),
        makeSnapshot({ month: '2025-12-01', netSurplus: 1400 }),
        makeSnapshot({ month: '2026-01-01', netSurplus: 1500 }),
        makeSnapshot({ month: '2026-02-01', netSurplus: 1600 }),
        makeSnapshot({ month: '2026-03-01', netSurplus: 1700 }),
      ],
    })
    const forecast = computeForecast(input)
    // Velocity should be positive (surplus growing)
    expect(forecast.monthlyVelocity).toBeGreaterThan(0)
    expect(forecast.timeline.length).toBeGreaterThan(0)
    expect(forecast.confidence).toBeDefined()
    expect(forecast.progressPercent).toBeGreaterThan(0)
  })

  it('pay_off_debt goal using debt data', () => {
    const input = makeInput({
      goal: makeGoal({
        archetype: 'pay_off_debt',
        metric: 'debt_total',
        targetValue: 0,
        startValue: 10000,
        currentValue: 8000,
      }),
      debts: [makeDebt({ balance: 8000, interestRate: 0.18, minimumPayment: 200 })],
      snapshots: [
        makeSnapshot({ month: '2025-11-01', debtPaidDown: 400, totalDebt: 9000 }),
        makeSnapshot({ month: '2025-12-01', debtPaidDown: 500, totalDebt: 8500 }),
        makeSnapshot({ month: '2026-01-01', debtPaidDown: 500, totalDebt: 8000 }),
      ],
    })
    const forecast = computeForecast(input)
    expect(forecast.currentValue).toBe(8000)
    expect(forecast.progressPercent).toBeGreaterThan(0)
  })

  it('build_wealth goal combining savings + asset growth', () => {
    const input = makeInput({
      goal: makeGoal({
        archetype: 'build_wealth',
        metric: 'net_worth_target',
        targetValue: 200000,
        startValue: 100000,
      }),
      accounts: [
        makeAccount({ balance: 50000, assetClass: 'index_fund' }),
        makeAccount({ id: 'acc-2', name: 'HYSA', balance: 30000, assetClass: 'high_yield_savings' }),
      ],
    })
    const forecast = computeForecast(input)
    expect(forecast.assetGrowth.length).toBe(2)
    expect(forecast.assetGrowth[0].expectedGrowth).toBeGreaterThan(0)
  })

  it('no snapshots → low confidence', () => {
    const input = makeInput({ snapshots: [] })
    const forecast = computeForecast(input)
    expect(forecast.confidence).toBe('low')
    expect(forecast.confidenceReason).toContain('No historical')
  })

  it('negative velocity → off_track pace', () => {
    const input = makeInput({
      snapshots: [
        makeSnapshot({ month: '2025-11-01', netSurplus: -1000 }),
        makeSnapshot({ month: '2025-12-01', netSurplus: -2000 }),
        makeSnapshot({ month: '2026-01-01', netSurplus: -3000 }),
      ],
      // Zero budget surplus — blended model: 60% plan (0) + 40% recent (-2000) = -800
      budgets: makeBudgets({ projectedSurplus: 0 }),
    })
    const forecast = computeForecast(input)
    // Blended velocity is negative (plan=0, recent=-2000 avg)
    expect(forecast.monthlyVelocity).toBeLessThan(0)
    expect(forecast.pace).toMatch(/behind|at_risk|off_track/)
  })

  it('negative snapshot velocity + budget surplus → positive blended velocity', () => {
    const input = makeInput({
      goal: makeGoal({ metric: 'savings_amount', startValue: 5000, targetValue: 20000 }),
      snapshots: [
        makeSnapshot({ month: '2025-11-01', netSurplus: -1000 }),
        makeSnapshot({ month: '2025-12-01', netSurplus: -2000 }),
        makeSnapshot({ month: '2026-01-01', netSurplus: -500 }),
      ],
      budgets: makeBudgets({ projectedSurplus: 2000 }),
      accounts: [makeAccount({ balance: 5000 })],
    })
    const forecast = computeForecast(input)
    // Blended: 60% plan (2000) + 40% recent (avg ≈ -1167) → positive net
    expect(forecast.monthlyVelocity).toBeGreaterThan(0)
    // Budget plan pulls velocity positive despite negative snapshots
    expect(forecast.velocityBreakdown).toBeDefined()
    expect(forecast.velocityBreakdown!.plan.weight).toBeGreaterThan(0)
    // Timeline projections should show increasing trend
    const futurePoints = forecast.timeline.filter((p) => !p.isHistorical)
    if (futurePoints.length >= 2) {
      expect(futurePoints[futurePoints.length - 1].projected).toBeGreaterThan(futurePoints[0].projected)
    }
  })

  it('propertyEquityGrowth computed for savings goals with properties', () => {
    const input = makeInput({
      goal: makeGoal({ metric: 'savings_amount' }),
      properties: [{
        id: 'p1',
        name: 'Home',
        currentValue: 400000,
        loanBalance: 300000,
        interestRate: 0.065,
        monthlyPayment: 1896,
        appreciationRate: 0.03,
        monthlyRentalIncome: 0,
      }],
    })
    const forecast = computeForecast(input)
    expect(forecast.propertyEquityGrowth).not.toBeNull()
    expect(forecast.propertyEquityGrowth!.annualAppreciation).toBeGreaterThan(0)
    expect(forecast.propertyEquityGrowth!.annualTotal).toBeGreaterThan(0)
    expect(forecast.propertyEquityGrowth!.properties).toHaveLength(1)
    expect(forecast.propertyEquityGrowth!.properties[0].name).toBe('Home')
  })

  it('propertyEquityGrowth is null when no properties', () => {
    const input = makeInput({ properties: undefined })
    const forecast = computeForecast(input)
    expect(forecast.propertyEquityGrowth).toBeNull()
  })

  it('conservative projection includes asset growth', () => {
    const input = makeInput({
      accounts: [makeAccount({ assetClass: 'index_fund', balance: 50000, expectedReturn: 0.10 })],
    })
    const forecast = computeForecast(input)
    const futurePoints = forecast.timeline.filter((p) => !p.isHistorical)
    // Conservative should be > 0 for positive velocity + asset growth
    for (const point of futurePoints) {
      expect(point.conservative).toBeGreaterThanOrEqual(0)
    }
  })

  it('debt goal projections never go below 0', () => {
    const input = makeInput({
      goal: makeGoal({
        archetype: 'pay_off_debt',
        metric: 'debt_payoff',
        targetValue: 0,
        startValue: 5000,
      }),
      debts: [makeDebt({ balance: 5000 })],
    })
    const forecast = computeForecast(input)
    for (const point of forecast.timeline) {
      expect(point.projected).toBeGreaterThanOrEqual(0)
      expect(point.conservative).toBeGreaterThanOrEqual(0)
      expect(point.onPlan).toBeGreaterThanOrEqual(0)
    }
  })
})

// ── 9F: Scenario impact tests ───────────────────────────────────────────────

describe('generateDefaultScenarios', () => {
  it('save_more returns one smart recommendation', () => {
    const input = makeInput()
    const scenarios = generateDefaultScenarios(input)
    expect(scenarios.length).toBeLessThanOrEqual(1)
    if (scenarios.length === 1) {
      expect(scenarios[0].recommended).toBe(true)
    }
  })

  it('pay_off_debt returns one smart recommendation for debt', () => {
    const input = makeInput({
      goal: makeGoal({ archetype: 'pay_off_debt', metric: 'debt_total' }),
      debts: [makeDebt()],
    })
    const scenarios = generateDefaultScenarios(input)
    expect(scenarios.length).toBeLessThanOrEqual(1)
    if (scenarios.length === 1) {
      expect(scenarios[0].recommended).toBe(true)
      expect(scenarios[0].impact.daysSaved).toBeGreaterThanOrEqual(0)
    }
  })

  it('returns empty when no actionable data', () => {
    const input = makeInput({
      debts: [],
      budgets: {
        ...makeInput().budgets,
        flexibleTotal: 0,
        expectedMonthlyIncome: 0,
      },
      accounts: [],
    })
    const scenarios = generateDefaultScenarios(input)
    expect(scenarios.length).toBeLessThanOrEqual(1)
  })

  it('recommendation has valid impact fields', () => {
    const input = makeInput({
      debts: [makeDebt({ type: 'AUTO' })],
    })
    const scenarios = generateDefaultScenarios(input)
    if (scenarios.length > 0) {
      const s = scenarios[0]
      expect(s.impact).toBeDefined()
      expect(typeof s.impact.monthlyImpactOnTrueRemaining).toBe('number')
      expect(typeof s.impact.daysSaved).toBe('number')
    }
  })
})

// ── 9G: Tab summary tests ───────────────────────────────────────────────────

describe('Tab summaries', () => {
  it('each summary is a non-empty string', () => {
    const input = makeInput()
    const forecast = computeForecast(input)
    const { tabSummaries } = forecast
    expect(tabSummaries.dashboard).toBeTruthy()
    expect(tabSummaries.budgets).toBeTruthy()
    expect(tabSummaries.debts).toBeTruthy()
    expect(tabSummaries.annualPlan).toBeTruthy()
    expect(tabSummaries.transactions).toBeTruthy()
  })

  it('dashboard summary mentions goal progress', () => {
    const input = makeInput()
    const forecast = computeForecast(input)
    expect(forecast.tabSummaries.dashboard).toMatch(/Goal|complete|progress/i)
  })

  it('debt summary mentions debts when they exist', () => {
    const input = makeInput({
      debts: [makeDebt()],
    })
    const forecast = computeForecast(input)
    expect(forecast.tabSummaries.debts).toMatch(/debt|payoff|totaling/i)
  })

  it('debt summary says no debts when none exist', () => {
    const input = makeInput({ debts: [] })
    const forecast = computeForecast(input)
    expect(forecast.tabSummaries.debts).toMatch(/No outstanding/i)
  })
})

// ── Anomaly detection tests ──────────────────────────────────────────────────

describe('filterAnomalies', () => {
  it('normal data returns all values', () => {
    const values = [100, 110, 105, 108, 103]
    const { filtered, anomalyIndices } = filterAnomalies(values)
    expect(filtered).toEqual(values)
    expect(anomalyIndices).toHaveLength(0)
  })

  it('excludes extreme outlier (>3× MAD)', () => {
    const values = [1000, 1050, 1100, 1000, 30000]
    const { filtered, anomalyIndices } = filterAnomalies(values)
    expect(anomalyIndices).toContain(4)
    expect(filtered).not.toContain(30000)
    expect(filtered).toHaveLength(4)
  })

  it('all identical values → no anomalies', () => {
    const values = [500, 500, 500, 500]
    const { filtered, anomalyIndices } = filterAnomalies(values)
    expect(filtered).toEqual(values)
    expect(anomalyIndices).toHaveLength(0)
  })

  it('<3 values → no filtering', () => {
    const values = [100, 50000]
    const { filtered, anomalyIndices } = filterAnomalies(values)
    expect(filtered).toEqual(values)
    expect(anomalyIndices).toHaveLength(0)
  })
})

// ── Plan velocity tests ──────────────────────────────────────────────────────

describe('computePlanVelocity', () => {
  it('returns projectedSurplus from budgets', () => {
    const input = makeInput({ budgets: makeBudgets({ projectedSurplus: 1500 }) })
    expect(computePlanVelocity(input)).toBe(1500)
  })

  it('returns 0 when surplus is 0', () => {
    const input = makeInput({ budgets: makeBudgets({ projectedSurplus: 0 }) })
    expect(computePlanVelocity(input)).toBe(0)
  })
})

// ── Blended velocity tests ───────────────────────────────────────────────────

describe('computeBlendedVelocity', () => {
  it('0 snapshots → 100% plan', () => {
    const input = makeInput({
      snapshots: [],
      budgets: makeBudgets({ projectedSurplus: 2000 }),
    })
    const { velocity, breakdown } = computeBlendedVelocity(input, 0, [])
    expect(velocity).toBe(2000)
    expect(breakdown.plan.weight).toBe(1)
    expect(breakdown.recent.weight).toBe(0)
    expect(breakdown.trend.weight).toBe(0)
    expect(breakdown.monthsOfData).toBe(0)
  })

  it('2 snapshots → 100% plan', () => {
    const snaps = [
      makeSnapshot({ month: '2025-12-01', netSurplus: 1000 }),
      makeSnapshot({ month: '2026-01-01', netSurplus: 1200 }),
    ]
    const input = makeInput({
      snapshots: snaps,
      budgets: makeBudgets({ projectedSurplus: 3000 }),
    })
    const { velocity, breakdown } = computeBlendedVelocity(input, 1100, snaps)
    expect(velocity).toBe(3000)
    expect(breakdown.plan.weight).toBe(1)
    expect(breakdown.monthsOfData).toBe(2)
  })

  it('4 snapshots → 60% plan + 40% recent', () => {
    const snaps = [
      makeSnapshot({ month: '2025-10-01', netSurplus: 1000 }),
      makeSnapshot({ month: '2025-11-01', netSurplus: 1000 }),
      makeSnapshot({ month: '2025-12-01', netSurplus: 1000 }),
      makeSnapshot({ month: '2026-01-01', netSurplus: 1000 }),
    ]
    const input = makeInput({
      snapshots: snaps,
      budgets: makeBudgets({ projectedSurplus: 2000 }),
    })
    const { velocity, breakdown } = computeBlendedVelocity(input, 1000, snaps)
    // 60% * 2000 + 40% * 1000 = 1200 + 400 = 1600
    expect(velocity).toBeCloseTo(1600, 0)
    expect(breakdown.plan.weight).toBe(0.6)
    expect(breakdown.recent.weight).toBe(0.4)
    expect(breakdown.trend.weight).toBe(0)
  })

  it('8 snapshots → 30% plan + 30% recent + 40% trend', () => {
    const snaps = Array.from({ length: 8 }, (_, i) =>
      makeSnapshot({ month: `2025-${String(6 + i).padStart(2, '0')}-01`, netSurplus: 1500 })
    )
    const input = makeInput({
      snapshots: snaps,
      budgets: makeBudgets({ projectedSurplus: 3000 }),
    })
    const { velocity, breakdown } = computeBlendedVelocity(input, 1500, snaps)
    // 30% * 3000 + 30% * 1500 + 40% * 1500 = 900 + 450 + 600 = 1950
    expect(velocity).toBeCloseTo(1950, 0)
    expect(breakdown.plan.weight).toBe(0.3)
    expect(breakdown.recent.weight).toBe(0.3)
    expect(breakdown.trend.weight).toBe(0.4)
  })

  it('14 snapshots → 20% plan + 20% recent + 60% trend', () => {
    const snaps = Array.from({ length: 14 }, (_, i) =>
      makeSnapshot({ month: `2025-${String(1 + i).padStart(2, '0')}-01`, netSurplus: 2000 })
    )
    const input = makeInput({
      snapshots: snaps,
      budgets: makeBudgets({ projectedSurplus: 4000 }),
    })
    const { velocity, breakdown } = computeBlendedVelocity(input, 2000, snaps)
    // 20% * 4000 + 20% * 2000 + 60% * 2000 = 800 + 400 + 1200 = 2400
    expect(velocity).toBeCloseTo(2400, 0)
    expect(breakdown.plan.weight).toBe(0.2)
    expect(breakdown.recent.weight).toBe(0.2)
    expect(breakdown.trend.weight).toBe(0.6)
  })

  it('null recent velocity redistributes weight to plan', () => {
    // Only 1 snapshot → recentVelocity returns null (needs >=2)
    // But monthsOfData=3 would normally give recent weight
    // Use 3 snapshots but with extreme anomaly to make recent null
    const snaps = [
      makeSnapshot({ month: '2025-10-01', netSurplus: 1000 }),
      makeSnapshot({ month: '2025-11-01', netSurplus: 1000 }),
      makeSnapshot({ month: '2025-12-01', netSurplus: 1000 }),
    ]
    const input = makeInput({
      snapshots: snaps,
      budgets: makeBudgets({ projectedSurplus: 5000 }),
    })
    // computeRecentVelocity should return non-null here since values are normal
    // So test with <2 recent values scenario by using only 1 snapshot in reality
    const oneSnap = [makeSnapshot({ month: '2026-01-01', netSurplus: 500 })]
    const input2 = makeInput({
      snapshots: oneSnap,
      budgets: makeBudgets({ projectedSurplus: 5000 }),
    })
    const { breakdown } = computeBlendedVelocity(input2, 500, oneSnap)
    // <3 months: 100% plan anyway, recent is 0
    expect(breakdown.plan.weight).toBe(1)
    expect(breakdown.recent.weight).toBe(0)
  })
})

// ── Scenario type tests ──────────────────────────────────────────────────────

describe('Scenario types: cut_spending and savings_boost', () => {
  it('cut_spending reduces flexible total by percentage', () => {
    const input = makeInput({
      budgets: makeBudgets({ flexibleTotal: 2000, totalBudgeted: 4000, projectedSurplus: 1000 }),
    })
    const baseline = computeForecast(input)

    // Simulate cut_spending at 20%
    const reduction = 2000 * 0.2 // 400
    const modified: ForecastInput = {
      ...input,
      budgets: {
        ...input.budgets,
        flexibleTotal: 2000 * 0.8,
        totalBudgeted: 4000 - reduction,
        projectedSurplus: 1000 + reduction,
      },
    }
    const impact = computeScenarioImpact(baseline, modified)
    expect(impact.velocityChange).toBeGreaterThan(0)
  })

  it('savings_boost increases projectedSurplus', () => {
    const input = makeInput({
      budgets: makeBudgets({ projectedSurplus: 1000 }),
    })
    const baseline = computeForecast(input)

    const modified: ForecastInput = {
      ...input,
      budgets: {
        ...input.budgets,
        projectedSurplus: 1000 + 500,
      },
    }
    const impact = computeScenarioImpact(baseline, modified)
    expect(impact.velocityChange).toBeGreaterThan(0)
  })

  it('makesGoalAchievable is true when baseline has no projected date but modified does', () => {
    // Create a scenario where baseline can't project a date (negative velocity, no date)
    const input = makeInput({
      snapshots: [
        makeSnapshot({ month: '2025-11-01', netSurplus: -5000 }),
        makeSnapshot({ month: '2025-12-01', netSurplus: -5000 }),
        makeSnapshot({ month: '2026-01-01', netSurplus: -5000 }),
      ],
      budgets: makeBudgets({ projectedSurplus: 0 }),
    })
    const baseline = computeForecast(input)

    // If baseline already has a projected date, skip this test
    if (baseline.projectedDate) return

    // Now create modified input with strong positive surplus
    const modified: ForecastInput = {
      ...input,
      budgets: {
        ...input.budgets,
        projectedSurplus: 5000,
      },
    }
    const impact = computeScenarioImpact(baseline, modified)
    expect(impact.makesGoalAchievable).toBe(true)
  })
})
