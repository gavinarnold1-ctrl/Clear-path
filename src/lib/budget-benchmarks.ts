import { db } from '@/lib/db'

export interface BudgetBenchmarkComparison {
  categoryName: string
  categoryGroup: string
  userMonthlySpend: number
  blsMonthlyAvg: number
  percentOfBenchmark: number  // user/BLS — 120% means 20% over
  delta: number               // positive = over benchmark, negative = under
  status: 'under' | 'at' | 'over' | 'way_over'  // under = <90%, at = 90-110%, over = 110-150%, way_over = >150%
}

/**
 * Compare user's budget spending against BLS benchmarks for their income bracket.
 * Only returns comparisons where a BLS match exists.
 */
export async function getBudgetBenchmarks(
  userId: string,
  categorySpending: { categoryId: string; categoryName: string; categoryGroup: string; spent: number }[],
  incomeRange: string | null,
): Promise<BudgetBenchmarkComparison[]> {
  if (!incomeRange) return []

  // Map incomeRange to BLS bracket
  const bracketMap: Record<string, { low: number; high: number }> = {
    'under_50k': { low: 0, high: 50000 },
    '50k_100k': { low: 50000, high: 100000 },
    '100k_150k': { low: 100000, high: 150000 },
    '150k_200k': { low: 150000, high: 200000 },
    '200k_300k': { low: 200000, high: 300000 },
    'over_300k': { low: 300000, high: 999999 },
  }
  const bracket = bracketMap[incomeRange]
  if (!bracket) return []

  // Fetch BLS benchmarks for the bracket
  const benchmarks = await db.spendingBenchmark.findMany({
    where: {
      incomeRangeLow: bracket.low,
      incomeRangeHigh: bracket.high,
    },
  })

  if (benchmarks.length === 0) return []

  // Fetch crosswalk mappings (BLS category → app category)
  const crosswalk = await db.spendingCategoryCrosswalk.findMany()

  // Build benchmark lookup by app category name
  const benchmarkByCategory = new Map<string, number>()
  for (const bm of benchmarks) {
    // Try direct appCategory field first (some benchmarks have it mapped directly)
    if (bm.appCategory) {
      benchmarkByCategory.set(bm.appCategory.toLowerCase(), bm.monthlyMean)
    }
    // Then try crosswalk
    const mapping = crosswalk.find((c: { blsCategory: string }) => c.blsCategory === bm.category)
    if (mapping) {
      benchmarkByCategory.set(mapping.appCategory.toLowerCase(), bm.monthlyMean)
    }
  }

  // Compare
  return categorySpending
    .map(cs => {
      const blsMonthly = benchmarkByCategory.get(cs.categoryName.toLowerCase())
        ?? benchmarkByCategory.get(cs.categoryGroup.toLowerCase())
      if (!blsMonthly || blsMonthly === 0) return null

      const userMonthly = Math.abs(cs.spent)  // spent is negative (expenses)
      const pct = (userMonthly / blsMonthly) * 100
      const delta = userMonthly - blsMonthly

      return {
        categoryName: cs.categoryName,
        categoryGroup: cs.categoryGroup,
        userMonthlySpend: userMonthly,
        blsMonthlyAvg: blsMonthly,
        percentOfBenchmark: Math.round(pct),
        delta: Math.round(delta),
        status: pct < 90 ? 'under' as const
          : pct <= 110 ? 'at' as const
          : pct <= 150 ? 'over' as const
          : 'way_over' as const,
      }
    })
    .filter((b): b is BudgetBenchmarkComparison => b !== null)
    .sort((a, b) => b.percentOfBenchmark - a.percentOfBenchmark) // Worst offenders first
}
