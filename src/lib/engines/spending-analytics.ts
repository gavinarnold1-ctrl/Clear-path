/**
 * Spending analytics engine — pure calculation logic, no database imports.
 *
 * Utility functions for spending trend analysis, volatility computation,
 * concentration indices, and seasonal pattern detection.
 */

/**
 * Compute coefficient of variation (std dev / mean) for a category's monthly spend.
 * Returns CV value and a human-readable label.
 */
export function computeVolatility(monthlyAmounts: number[]): { cv: number; label: string } {
  if (monthlyAmounts.length < 2) return { cv: 0, label: 'N/A' }

  const nonZero = monthlyAmounts.filter((a) => a !== 0)
  if (nonZero.length < 2) return { cv: 0, label: 'N/A' }

  const mean = nonZero.reduce((s, v) => s + v, 0) / nonZero.length
  if (mean === 0) return { cv: 0, label: 'N/A' }

  const variance = nonZero.reduce((s, v) => s + (v - mean) ** 2, 0) / nonZero.length
  const cv = Math.sqrt(variance) / Math.abs(mean)

  if (cv < 0.3) return { cv, label: 'Low' }
  if (cv <= 0.6) return { cv, label: 'Moderate' }
  return { cv, label: 'High' }
}

/**
 * Compute a Herfindahl-Hirschman Index for spending concentration.
 * Returns 0-1 where 1 = all spending in one category.
 * Below 0.15 = well-diversified, 0.15-0.25 = moderate, above 0.25 = concentrated.
 */
export function computeConcentration(
  categoryTotals: { category: string; total: number }[]
): number {
  if (categoryTotals.length === 0) return 0

  const totalSpend = categoryTotals.reduce((s, c) => s + Math.abs(c.total), 0)
  if (totalSpend === 0) return 0

  return categoryTotals.reduce((hhi, c) => {
    const share = Math.abs(c.total) / totalSpend
    return hhi + share * share
  }, 0)
}

/**
 * Compute simple linear trend direction from a time series.
 * Returns slope: positive = improving, negative = declining, near-zero = stable.
 * Uses least-squares regression.
 */
export function computeTrend(values: number[]): number {
  if (values.length < 2) return 0

  const n = values.length
  const xMean = (n - 1) / 2
  const yMean = values.reduce((s, v) => s + v, 0) / n

  let numerator = 0
  let denominator = 0
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (values[i] - yMean)
    denominator += (i - xMean) ** 2
  }

  return denominator === 0 ? 0 : numerator / denominator
}

/**
 * Compute financial complexity score (0-100) based on user's financial situation.
 */
export function computeComplexity(factors: {
  accountCount: number
  hasProperties: boolean
  hasBusinessEntities: boolean
  hasMortgage: boolean
  hasStudentLoans: boolean
  hasCreditCardDebt: boolean
  householdSize: number
}): number {
  let score = 0

  // Account complexity (0-25)
  score += Math.min(factors.accountCount * 5, 25)

  // Property ownership (0-15)
  if (factors.hasProperties) score += 10
  if (factors.hasBusinessEntities) score += 5

  // Debt complexity (0-30)
  if (factors.hasMortgage) score += 15
  if (factors.hasStudentLoans) score += 10
  if (factors.hasCreditCardDebt) score += 5

  // Household size (0-15)
  score += Math.min((factors.householdSize - 1) * 5, 15)

  // Base complexity for having any financial activity (15)
  if (factors.accountCount > 0) score += 15

  return Math.min(score, 100)
}

/**
 * Detect seasonal patterns in monthly spending.
 * Returns months that are >1.5 standard deviations above average with likely reason.
 */
export function detectSeasonalPatterns(
  monthlyBreakdown: { month: string; totalExpenses: number }[]
): { month: string; amount: number; deviation: number; likelyReason: string }[] {
  if (monthlyBreakdown.length < 3) return []

  const amounts = monthlyBreakdown.map((m) => Math.abs(m.totalExpenses))
  const mean = amounts.reduce((s, v) => s + v, 0) / amounts.length
  if (mean === 0) return []

  const variance = amounts.reduce((s, v) => s + (v - mean) ** 2, 0) / amounts.length
  const stdDev = Math.sqrt(variance)
  if (stdDev === 0) return []

  const seasonalReasons: Record<string, string> = {
    '01': 'Post-holiday spending, annual subscriptions',
    '02': "Valentine's Day",
    '03': 'Spring expenses, tax preparation',
    '04': 'Tax payments, spring shopping',
    '05': "Mother's Day, Memorial Day",
    '06': 'Summer travel begins',
    '07': 'Summer vacation, July 4th',
    '08': 'Back-to-school shopping',
    '09': 'Fall expenses, Labor Day',
    '10': 'Fall shopping, Halloween',
    '11': 'Black Friday, Thanksgiving',
    '12': 'Holiday gifts, year-end expenses',
  }

  return monthlyBreakdown
    .filter((_, i) => {
      const deviation = (amounts[i] - mean) / stdDev
      return deviation > 1.5
    })
    .map((m, _, arr) => {
      const idx = monthlyBreakdown.indexOf(m)
      const deviation = (amounts[idx] - mean) / stdDev
      const monthNum = m.month.slice(5, 7)
      return {
        month: m.month,
        amount: amounts[idx],
        deviation: Math.round(deviation * 100) / 100,
        likelyReason: seasonalReasons[monthNum] ?? 'Unusual spending spike',
      }
    })
}
