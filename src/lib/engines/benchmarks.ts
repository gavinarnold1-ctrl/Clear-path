/**
 * Benchmark comparison engine — pure calculation logic, no database imports.
 *
 * Compares user spending against BLS Consumer Expenditure Survey data.
 * Database lookups (fetching benchmark rows) stay in API routes.
 */

import type { SpendingBenchmark, EfficiencyRating } from '@/types/insights'

export type { SpendingBenchmark, EfficiencyRating }

export interface HouseholdProfile {
  annualIncome: number
  householdSize: number
  region: string // 'northeast', 'midwest', 'south', 'west'
  housingTenure: string // 'owner' | 'renter'
}

export interface CategoryComparison {
  category: string
  userMonthly: number
  benchmarkMonthly: number
  difference: number // positive = over benchmark
  percentOfBenchmark: number
}

export interface OverallComparison {
  categories: CategoryComparison[]
  totalUserSpend: number
  totalBenchmarkSpend: number
  incomeQuintile: number
}

// Based on BLS Consumer Expenditure Survey 2024 ($100K–$150K income bracket)
// Retrieved from FRED, December 2025 release
// These are MONTHLY figures; p25/p75 estimated from spread ratios
export const BENCHMARKS: Record<string, SpendingBenchmark> = {
  'Food & Groceries': {
    category: 'Food & Groceries',
    monthlyMedian: 593,
    p25: 425,
    p75: 810,
    source: 'BLS CE Survey 2024',
  },
  'Dining & Restaurants': {
    category: 'Dining & Restaurants',
    monthlyMedian: 399,
    p25: 230,
    p75: 620,
    source: 'BLS CE Survey 2024',
  },
  Transportation: {
    category: 'Transportation',
    monthlyMedian: 1335,
    p25: 880,
    p75: 1885,
    source: 'BLS CE Survey 2024',
  },
  Entertainment: {
    category: 'Entertainment',
    monthlyMedian: 344,
    p25: 180,
    p75: 560,
    source: 'BLS CE Survey 2024',
  },
  Subscriptions: {
    category: 'Subscriptions',
    monthlyMedian: 90,
    p25: 48,
    p75: 160,
    source: 'BLS CE Survey 2024',
  },
  Shopping: {
    category: 'Shopping',
    monthlyMedian: 210,
    p25: 105,
    p75: 370,
    source: 'BLS CE Survey 2024',
  },
  Utilities: {
    category: 'Utilities',
    monthlyMedian: 390,
    p25: 275,
    p75: 530,
    source: 'BLS CE Survey 2024',
  },
  'Personal Care': {
    category: 'Personal Care',
    monthlyMedian: 90,
    p25: 48,
    p75: 165,
    source: 'BLS CE Survey 2024',
  },
  'Health & Medical': {
    category: 'Health & Medical',
    monthlyMedian: 596,
    p25: 315,
    p75: 965,
    source: 'BLS CE Survey 2024',
  },
  Insurance: {
    category: 'Insurance',
    monthlyMedian: 935,
    p25: 625,
    p75: 1355,
    source: 'BLS CE Survey 2024',
  },
  Groceries: {
    category: 'Groceries',
    monthlyMedian: 593,
    p25: 425,
    p75: 810,
    source: 'BLS CE Survey 2024',
  },
  Rent: {
    category: 'Rent',
    monthlyMedian: 1475,
    p25: 1000,
    p75: 2100,
    source: 'BLS CE Survey 2024',
  },
}

export function getBenchmark(category: string): SpendingBenchmark | null {
  if (!category) return null

  // Exact match first
  if (BENCHMARKS[category]) return BENCHMARKS[category]

  // Fuzzy match category names to benchmark categories
  const normalized = category.toLowerCase()
  for (const [key, benchmark] of Object.entries(BENCHMARKS)) {
    if (normalized.includes(key.toLowerCase()) || key.toLowerCase().includes(normalized)) {
      return benchmark
    }
  }
  return null
}

export function getEfficiencyRating(actual: number, benchmark: SpendingBenchmark): EfficiencyRating {
  if (actual <= benchmark.p25) return 'excellent'
  if (actual <= benchmark.monthlyMedian) return 'good'
  if (actual <= benchmark.p75) return 'average'
  if (actual <= benchmark.p75 * 1.3) return 'high'
  return 'excessive'
}

// BLS income quintile thresholds (2024 annual household income)
const INCOME_QUINTILE_THRESHOLDS = [30000, 55000, 90000, 150000]

/** Determine income quintile from annual income (1=lowest, 5=highest) */
export function incomeQuintile(annualIncome: number): number {
  for (let i = 0; i < INCOME_QUINTILE_THRESHOLDS.length; i++) {
    if (annualIncome < INCOME_QUINTILE_THRESHOLDS[i]) return i + 1
  }
  return 5
}

/** Compare user spending against BLS benchmarks for their profile */
export function compareSpending(
  userSpending: Record<string, number>, // app category → monthly amount
  benchmarks: Array<{ appCategory: string; monthlyMean: number }>,
  _profile: HouseholdProfile,
): OverallComparison {
  const categories: CategoryComparison[] = []
  let totalUserSpend = 0
  let totalBenchmarkSpend = 0

  for (const bm of benchmarks) {
    const userAmount = userSpending[bm.appCategory] ?? 0
    const difference = userAmount - bm.monthlyMean
    const percentOfBenchmark = bm.monthlyMean > 0 ? (userAmount / bm.monthlyMean) * 100 : 0

    categories.push({
      category: bm.appCategory,
      userMonthly: Math.round(userAmount * 100) / 100,
      benchmarkMonthly: bm.monthlyMean,
      difference: Math.round(difference * 100) / 100,
      percentOfBenchmark: Math.round(percentOfBenchmark * 10) / 10,
    })

    totalUserSpend += userAmount
    totalBenchmarkSpend += bm.monthlyMean
  }

  return {
    categories,
    totalUserSpend: Math.round(totalUserSpend * 100) / 100,
    totalBenchmarkSpend: Math.round(totalBenchmarkSpend * 100) / 100,
    incomeQuintile: incomeQuintile(_profile.annualIncome),
  }
}

/** Calculate spending efficiency score (0-100) */
export function efficiencyScore(comparison: OverallComparison): number {
  if (comparison.categories.length === 0) return 50

  // Each category contributes based on how close user is to benchmark
  let totalWeight = 0
  let weightedScore = 0

  for (const cat of comparison.categories) {
    if (cat.benchmarkMonthly <= 0) continue

    const ratio = cat.userMonthly / cat.benchmarkMonthly
    // Score: 100 if at or under 50% of benchmark, 0 if at 200%+
    let catScore: number
    if (ratio <= 0.5) catScore = 100
    else if (ratio <= 1.0) catScore = 100 - (ratio - 0.5) * 40 // 100 → 80
    else if (ratio <= 1.3) catScore = 80 - (ratio - 1.0) * 100 // 80 → 50
    else if (ratio <= 2.0) catScore = 50 - (ratio - 1.3) * 71.4 // 50 → 0
    else catScore = 0

    const weight = cat.benchmarkMonthly // weight by benchmark size
    weightedScore += catScore * weight
    totalWeight += weight
  }

  const score = totalWeight > 0 ? weightedScore / totalWeight : 50
  return Math.round(Math.max(0, Math.min(100, score)))
}
