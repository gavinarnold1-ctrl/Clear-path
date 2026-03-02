import { getBenchmark, getEfficiencyRating, BENCHMARKS } from '@/lib/benchmarks'

describe('getBenchmark', () => {
  it('returns exact match for known category', () => {
    const result = getBenchmark('Groceries')
    expect(result).not.toBeNull()
    expect(result!.category).toBe('Groceries')
    expect(result!.monthlyMedian).toBe(593)
  })

  it('returns exact match for multi-word category', () => {
    const result = getBenchmark('Food & Groceries')
    expect(result).not.toBeNull()
    expect(result!.category).toBe('Food & Groceries')
  })

  it('returns fuzzy match when category name partially matches', () => {
    const result = getBenchmark('entertainment')
    expect(result).not.toBeNull()
    expect(result!.category).toBe('Entertainment')
  })

  it('returns fuzzy match for partial name', () => {
    const result = getBenchmark('Dining')
    expect(result).not.toBeNull()
    expect(result!.category).toBe('Dining & Restaurants')
  })

  it('returns null for unknown category', () => {
    const result = getBenchmark('Crypto Trading')
    expect(result).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(getBenchmark('')).toBeNull()
  })
})

describe('getEfficiencyRating', () => {
  const benchmark = BENCHMARKS['Entertainment']

  it('returns "excellent" when spending is at or below p25', () => {
    expect(getEfficiencyRating(100, benchmark)).toBe('excellent')
    expect(getEfficiencyRating(180, benchmark)).toBe('excellent')
  })

  it('returns "good" when spending is between p25 and median', () => {
    expect(getEfficiencyRating(250, benchmark)).toBe('good')
  })

  it('returns "average" when spending is between median and p75', () => {
    expect(getEfficiencyRating(450, benchmark)).toBe('average')
  })

  it('returns "high" when spending is between p75 and p75 * 1.3', () => {
    expect(getEfficiencyRating(650, benchmark)).toBe('high')
  })

  it('returns "excessive" when spending exceeds p75 * 1.3', () => {
    expect(getEfficiencyRating(800, benchmark)).toBe('excessive')
  })

  it('returns "excellent" for zero spending', () => {
    expect(getEfficiencyRating(0, benchmark)).toBe('excellent')
  })
})
