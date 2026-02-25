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

// Based on BLS Consumer Expenditure Survey 2023
// Adjusted for single/dual income households
// These are MONTHLY figures
export const BENCHMARKS: Record<string, SpendingBenchmark> = {
  'Food & Groceries': {
    category: 'Food & Groceries',
    monthlyMedian: 475,
    p25: 340,
    p75: 650,
    source: 'BLS CE Survey 2023',
  },
  'Dining & Restaurants': {
    category: 'Dining & Restaurants',
    monthlyMedian: 310,
    p25: 180,
    p75: 480,
    source: 'BLS CE Survey 2023',
  },
  Transportation: {
    category: 'Transportation',
    monthlyMedian: 580,
    p25: 380,
    p75: 820,
    source: 'BLS CE Survey 2023',
  },
  Entertainment: {
    category: 'Entertainment',
    monthlyMedian: 245,
    p25: 130,
    p75: 400,
    source: 'BLS CE Survey 2023',
  },
  Subscriptions: {
    category: 'Subscriptions',
    monthlyMedian: 85,
    p25: 45,
    p75: 150,
    source: 'BLS CE Survey 2023',
  },
  Shopping: {
    category: 'Shopping',
    monthlyMedian: 200,
    p25: 100,
    p75: 350,
    source: 'BLS CE Survey 2023',
  },
  Utilities: {
    category: 'Utilities',
    monthlyMedian: 370,
    p25: 260,
    p75: 500,
    source: 'BLS CE Survey 2023',
  },
  'Personal Care': {
    category: 'Personal Care',
    monthlyMedian: 65,
    p25: 35,
    p75: 120,
    source: 'BLS CE Survey 2023',
  },
  'Health & Medical': {
    category: 'Health & Medical',
    monthlyMedian: 340,
    p25: 180,
    p75: 550,
    source: 'BLS CE Survey 2023',
  },
  Insurance: {
    category: 'Insurance',
    monthlyMedian: 290,
    p25: 195,
    p75: 420,
    source: 'BLS CE Survey 2023',
  },
  Groceries: {
    category: 'Groceries',
    monthlyMedian: 475,
    p25: 340,
    p75: 650,
    source: 'BLS CE Survey 2023',
  },
  Rent: {
    category: 'Rent',
    monthlyMedian: 1400,
    p25: 950,
    p75: 2000,
    source: 'BLS CE Survey 2023',
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

// BLS income quintile thresholds (2023 annual household income)
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
