import {
  formatMonthName,
  formatOrdinalDay,
  monthsUntilDue,
  calculateMonthlySetAside,
  isWithinVariance,
  calculateTierSummary,
  tierLabel,
} from '@/lib/budget-engine'

describe('formatMonthName', () => {
  it('returns correct month names', () => {
    expect(formatMonthName(1)).toBe('January')
    expect(formatMonthName(6)).toBe('June')
    expect(formatMonthName(12)).toBe('December')
  })

  it('handles out-of-range months', () => {
    expect(formatMonthName(0)).toBe('Month 0')
    expect(formatMonthName(13)).toBe('Month 13')
  })
})

describe('formatOrdinalDay', () => {
  it('adds correct suffixes', () => {
    expect(formatOrdinalDay(1)).toBe('1st')
    expect(formatOrdinalDay(2)).toBe('2nd')
    expect(formatOrdinalDay(3)).toBe('3rd')
    expect(formatOrdinalDay(4)).toBe('4th')
    expect(formatOrdinalDay(11)).toBe('11th')
    expect(formatOrdinalDay(12)).toBe('12th')
    expect(formatOrdinalDay(13)).toBe('13th')
    expect(formatOrdinalDay(21)).toBe('21st')
    expect(formatOrdinalDay(22)).toBe('22nd')
    expect(formatOrdinalDay(31)).toBe('31st')
  })
})

describe('monthsUntilDue', () => {
  it('calculates months in the same year', () => {
    const feb2026 = new Date(2026, 1, 15) // Feb 2026
    expect(monthsUntilDue(6, 2026, feb2026)).toBe(4) // June is 4 months away
  })

  it('calculates months across years', () => {
    const oct2026 = new Date(2026, 9, 1) // Oct 2026
    expect(monthsUntilDue(3, 2027, oct2026)).toBe(5) // March 2027 is 5 months away
  })

  it('returns 0 when due month has passed', () => {
    const aug2026 = new Date(2026, 7, 1) // August 2026
    expect(monthsUntilDue(3, 2026, aug2026)).toBe(0) // March 2026 already passed
  })

  it('returns 0 when due this month', () => {
    const jun2026 = new Date(2026, 5, 15) // June 2026
    expect(monthsUntilDue(6, 2026, jun2026)).toBe(0)
  })
})

describe('calculateMonthlySetAside', () => {
  it('divides remaining by months left', () => {
    const feb2026 = new Date(2026, 1, 1)
    // $2000 due in June 2026, $0 funded, 4 months away
    expect(calculateMonthlySetAside(2000, 0, 6, 2026, feb2026)).toBe(500)
  })

  it('accounts for existing funding', () => {
    const feb2026 = new Date(2026, 1, 1)
    // $2000 due in June 2026, $800 funded, 4 months away -> $1200/4 = $300
    expect(calculateMonthlySetAside(2000, 800, 6, 2026, feb2026)).toBe(300)
  })

  it('returns 0 when fully funded', () => {
    const feb2026 = new Date(2026, 1, 1)
    expect(calculateMonthlySetAside(2000, 2000, 6, 2026, feb2026)).toBe(0)
  })

  it('returns 0 when overfunded', () => {
    const feb2026 = new Date(2026, 1, 1)
    expect(calculateMonthlySetAside(2000, 2500, 6, 2026, feb2026)).toBe(0)
  })

  it('returns full remaining when due now', () => {
    const jun2026 = new Date(2026, 5, 15)
    // Due June 2026, it's June 2026 -> 0 months left, need all remaining
    expect(calculateMonthlySetAside(2000, 500, 6, 2026, jun2026)).toBe(1500)
  })

  it('rounds up to nearest cent', () => {
    const feb2026 = new Date(2026, 1, 1)
    // $100 / 3 months = $33.33... -> should round up to $33.34
    expect(calculateMonthlySetAside(100, 0, 5, 2026, feb2026)).toBe(33.34)
  })
})

describe('isWithinVariance', () => {
  it('returns true when no variance limit', () => {
    expect(isWithinVariance(100, 500, null)).toBe(true)
  })

  it('returns true when within limit', () => {
    expect(isWithinVariance(100, 105, 10)).toBe(true)
  })

  it('returns true when exactly at limit', () => {
    expect(isWithinVariance(100, 110, 10)).toBe(true)
  })

  it('returns false when exceeding limit', () => {
    expect(isWithinVariance(100, 115, 10)).toBe(false)
  })

  it('handles negative deviation', () => {
    expect(isWithinVariance(100, 85, 10)).toBe(false)
    expect(isWithinVariance(100, 92, 10)).toBe(true)
  })
})

describe('calculateTierSummary', () => {
  it('aggregates fixed budgets', () => {
    const budgets = [
      { tier: 'FIXED' as const, amount: 1500, spent: 1500, annualExpense: null },
      { tier: 'FIXED' as const, amount: 80, spent: 0, annualExpense: null },
    ]
    const summary = calculateTierSummary(budgets)
    expect(summary.fixed.total).toBe(1580)
    expect(summary.fixed.paidCount).toBe(1)
    expect(summary.fixed.totalCount).toBe(2)
  })

  it('aggregates flexible budgets', () => {
    const budgets = [
      { tier: 'FLEXIBLE' as const, amount: 500, spent: 250, annualExpense: null },
      { tier: 'FLEXIBLE' as const, amount: 200, spent: 100, annualExpense: null },
    ]
    const summary = calculateTierSummary(budgets)
    expect(summary.flexible.budgeted).toBe(700)
    expect(summary.flexible.spent).toBe(350)
    expect(summary.flexible.remaining).toBe(350)
  })

  it('aggregates annual budgets', () => {
    const budgets = [
      { tier: 'ANNUAL' as const, amount: 0, spent: 0, annualExpense: { monthlySetAside: 300, annualAmount: 3600, funded: 600 } },
      { tier: 'ANNUAL' as const, amount: 0, spent: 0, annualExpense: { monthlySetAside: 100, annualAmount: 1200, funded: 200 } },
    ]
    const summary = calculateTierSummary(budgets)
    expect(summary.annual.monthlySetAside).toBe(400)
    expect(summary.annual.totalAnnual).toBe(4800)
    expect(summary.annual.totalFunded).toBe(800)
  })

  it('calculates total monthly obligation across all tiers', () => {
    const budgets = [
      { tier: 'FIXED' as const, amount: 1500, spent: 1500, annualExpense: null },
      { tier: 'FLEXIBLE' as const, amount: 500, spent: 200, annualExpense: null },
      { tier: 'ANNUAL' as const, amount: 0, spent: 0, annualExpense: { monthlySetAside: 300, annualAmount: 3600, funded: 600 } },
    ]
    const summary = calculateTierSummary(budgets)
    expect(summary.totalMonthlyObligation).toBe(2300) // 1500 + 500 + 300
  })

  it('handles empty budget array', () => {
    const summary = calculateTierSummary([])
    expect(summary.fixed.total).toBe(0)
    expect(summary.flexible.budgeted).toBe(0)
    expect(summary.annual.monthlySetAside).toBe(0)
    expect(summary.totalMonthlyObligation).toBe(0)
  })
})

describe('tierLabel', () => {
  it('returns human-readable labels', () => {
    expect(tierLabel('FIXED')).toBe('Fixed')
    expect(tierLabel('FLEXIBLE')).toBe('Flexible')
    expect(tierLabel('ANNUAL')).toBe('Annual')
  })
})
