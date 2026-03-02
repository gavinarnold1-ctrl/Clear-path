import { calculateDepreciation, generateTaxSummary } from '@/lib/engines/tax'

describe('calculateDepreciation', () => {
  it('calculates standard case: $300K purchase, 80% building, 5 years', () => {
    const result = calculateDepreciation({
      purchasePrice: 300000,
      purchaseDate: new Date(2021, 0, 15), // Jan 15, 2021
      buildingValuePct: 80,
      priorDepreciation: 0,
      asOfDate: new Date(2026, 0, 15), // Jan 15, 2026
    })

    expect(result.buildingValue).toBe(240000)
    expect(result.landValue).toBe(60000)
    // 240000 / 27.5 = 8727.27
    expect(result.annualDepreciation).toBe(8727.27)
    expect(result.monthlyDepreciation).toBe(727.27)
    // 5 years elapsed: 0.5 (Jan 2021) + 60 full months (Feb 2021 → Jan 2026) = 60.5 months
    expect(result.yearsElapsed).toBe(5.04) // 60.5 / 12
    expect(result.yearsRemaining).toBe(22.46) // 27.5 - 5.04
    expect(result.totalDepreciation).toBeGreaterThan(0)
    expect(result.remainingBasis).toBeLessThan(240000)
    expect(result.remainingBasis).toBeGreaterThan(0)
  })

  it('accounts for prior depreciation', () => {
    const result = calculateDepreciation({
      purchasePrice: 300000,
      purchaseDate: new Date(2021, 0, 15),
      buildingValuePct: 80,
      priorDepreciation: 20000,
      asOfDate: new Date(2026, 0, 15),
    })

    expect(result.priorDepreciation).toBe(20000)
    // Current year depreciation should be limited by what's left after prior
    expect(result.currentYearDepreciation).toBeLessThanOrEqual(
      result.buildingValue - result.priorDepreciation,
    )
  })

  it('caps total depreciation at building value (27.5+ years)', () => {
    const result = calculateDepreciation({
      purchasePrice: 100000,
      purchaseDate: new Date(1990, 0, 1), // 36 years ago
      buildingValuePct: 80,
      priorDepreciation: 0,
      asOfDate: new Date(2026, 0, 1),
    })

    // Building value = $80,000. After 27.5+ years, total depreciation = building value
    expect(result.totalDepreciation).toBe(result.buildingValue)
    expect(result.remainingBasis).toBe(0)
    expect(result.yearsRemaining).toBe(0)
  })

  it('handles first-year proration (mid-month convention)', () => {
    // Purchase in June 2026, calculate through December 2026
    const result = calculateDepreciation({
      purchasePrice: 200000,
      purchaseDate: new Date(2026, 5, 1), // June 1, 2026
      buildingValuePct: 80,
      priorDepreciation: 0,
      asOfDate: new Date(2026, 11, 31), // Dec 31, 2026
    })

    // Building value = $160,000, annual = $5,818.18
    expect(result.buildingValue).toBe(160000)
    expect(result.annualDepreciation).toBe(5818.18)

    // June (0.5 month) + July-Dec (6 full months) = 6.5 months
    // Current year = 6.5 * (5818.18 / 12) = 6.5 * 484.85 = $3,151.52
    expect(result.currentYearDepreciation).toBeCloseTo(3151.52, 0)
  })

  it('returns zero depreciation for 0% building (100% land)', () => {
    const result = calculateDepreciation({
      purchasePrice: 300000,
      purchaseDate: new Date(2020, 0, 1),
      buildingValuePct: 0,
      priorDepreciation: 0,
      asOfDate: new Date(2026, 0, 1),
    })

    expect(result.buildingValue).toBe(0)
    expect(result.landValue).toBe(300000)
    expect(result.annualDepreciation).toBe(0)
    expect(result.monthlyDepreciation).toBe(0)
    expect(result.totalDepreciation).toBe(0)
    expect(result.currentYearDepreciation).toBe(0)
    expect(result.remainingBasis).toBe(0)
    expect(result.yearsElapsed).toBe(0)
    expect(result.yearsRemaining).toBe(0)
  })

  it('handles same-month purchase and calculation', () => {
    const result = calculateDepreciation({
      purchasePrice: 240000,
      purchaseDate: new Date(2026, 2, 1), // March 2026
      buildingValuePct: 80,
      priorDepreciation: 0,
      asOfDate: new Date(2026, 2, 31), // March 2026
    })

    // Same month: 0.5 months of depreciation (mid-month convention)
    expect(result.buildingValue).toBe(192000)
    // 0.5 months × monthly rate
    const expectedMonthly = result.annualDepreciation / 12
    expect(result.totalDepreciation).toBeCloseTo(expectedMonthly * 0.5, 1)
  })

  it('does not exceed annual depreciation for current year', () => {
    const result = calculateDepreciation({
      purchasePrice: 300000,
      purchaseDate: new Date(2020, 0, 1),
      buildingValuePct: 80,
      priorDepreciation: 0,
      asOfDate: new Date(2026, 11, 31),
    })

    // Current year depreciation should not exceed one full year
    expect(result.currentYearDepreciation).toBeLessThanOrEqual(result.annualDepreciation)
  })
})

describe('generateTaxSummary', () => {
  const dateRange = { start: new Date(2026, 0, 1), end: new Date(2026, 11, 31) }

  it('aggregates Schedule E rental income and expenses', () => {
    const properties = [
      {
        id: 'rental-1',
        name: 'Duplex Unit A',
        type: 'RENTAL',
        taxSchedule: 'SCHEDULE_E',
        purchasePrice: 300000,
        purchaseDate: new Date(2020, 0, 1),
        buildingValuePct: 80,
        priorDepreciation: 0,
      },
    ]

    const directAttributions = [
      {
        propertyId: 'rental-1',
        amount: 1500,
        classification: 'income',
        category: { group: 'Income', name: 'Rental Income' },
      },
      {
        propertyId: 'rental-1',
        amount: -400,
        classification: 'expense',
        category: { group: 'Housing', name: 'Insurance', scheduleECategory: 'Insurance' },
      },
      {
        propertyId: 'rental-1',
        amount: -200,
        classification: 'expense',
        category: { group: 'Housing', name: 'Repairs', scheduleECategory: 'Repairs' },
      },
    ]

    const result = generateTaxSummary([], directAttributions, properties, dateRange)

    expect(result.scheduleE.properties).toHaveLength(1)
    const rental = result.scheduleE.properties[0]
    expect(rental.propertyName).toBe('Duplex Unit A')
    expect(rental.income).toBe(1500)
    expect(rental.expenses).toHaveLength(2)
    expect(rental.depreciation).toBeGreaterThan(0) // Should have depreciation
    expect(rental.netIncome).toBe(
      Math.round((1500 - 400 - 200 - rental.depreciation) * 100) / 100,
    )
  })

  it('aggregates Schedule C business income and expenses', () => {
    const properties = [
      { id: 'biz-1', name: 'My Consulting', type: 'BUSINESS', taxSchedule: 'SCHEDULE_C' },
    ]

    const directAttributions = [
      {
        propertyId: 'biz-1',
        amount: 5000,
        classification: 'income',
        category: { group: 'Income', name: 'Business Income' },
      },
      {
        propertyId: 'biz-1',
        amount: -200,
        classification: 'expense',
        category: { group: 'Financial', name: 'Software Subscriptions' },
      },
    ]

    const result = generateTaxSummary([], directAttributions, properties, dateRange)

    expect(result.scheduleC.businesses).toHaveLength(1)
    const biz = result.scheduleC.businesses[0]
    expect(biz.businessName).toBe('My Consulting')
    expect(biz.income).toBe(5000)
    expect(biz.expenses).toHaveLength(1)
    expect(biz.netIncome).toBe(4800)
  })

  it('aggregates Schedule A personal deductions', () => {
    const properties = [
      { id: 'home', name: 'Primary Residence', type: 'PERSONAL', taxSchedule: 'SCHEDULE_A' },
    ]

    const directAttributions = [
      {
        propertyId: 'home',
        amount: -800,
        classification: 'expense',
        category: { group: 'Housing', name: 'Mortgage Interest' },
      },
      {
        propertyId: 'home',
        amount: -300,
        classification: 'expense',
        category: { group: 'Housing', name: 'Property Tax' },
      },
    ]

    const result = generateTaxSummary([], directAttributions, properties, dateRange)

    expect(result.scheduleA.mortgageInterest).toBe(800)
    expect(result.scheduleA.propertyTax).toBe(300)
    expect(result.scheduleA.total).toBe(1100)
  })

  it('handles mixed splits and direct attributions', () => {
    const properties = [
      { id: 'rental-1', name: 'Unit A', type: 'RENTAL', taxSchedule: 'SCHEDULE_E' },
    ]

    const splits = [
      {
        propertyId: 'rental-1',
        amount: -150,
        transaction: {
          classification: 'expense',
          category: { group: 'Housing', name: 'Utilities', scheduleECategory: 'Utilities' },
        },
      },
    ]

    const directAttributions = [
      {
        propertyId: 'rental-1',
        amount: -100,
        classification: 'expense',
        category: { group: 'Housing', name: 'Utilities', scheduleECategory: 'Utilities' },
      },
    ]

    const result = generateTaxSummary(splits, directAttributions, properties, dateRange)

    const rental = result.scheduleE.properties[0]
    // Utilities should combine: 150 + 100 = 250
    const utilitiesExpense = rental.expenses.find((e) => e.category === 'Utilities')
    expect(utilitiesExpense?.amount).toBe(250)
  })

  it('returns empty summaries when no data', () => {
    const result = generateTaxSummary([], [], [], dateRange)

    expect(result.scheduleA.total).toBe(0)
    expect(result.scheduleE.properties).toHaveLength(0)
    expect(result.scheduleE.totalNetIncome).toBe(0)
    expect(result.scheduleC.businesses).toHaveLength(0)
    expect(result.scheduleC.totalNetIncome).toBe(0)
  })
})
