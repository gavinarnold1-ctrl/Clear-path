import type { SpendingBenchmark, EfficiencyRating } from '@/types/insights'

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
