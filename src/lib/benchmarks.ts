// Re-export from engine module — the canonical implementation lives in engines/benchmarks.ts
export {
  BENCHMARKS,
  getBenchmark,
  getEfficiencyRating,
  incomeQuintile,
  compareSpending,
  efficiencyScore,
} from './engines/benchmarks'
export type {
  SpendingBenchmark,
  EfficiencyRating,
  HouseholdProfile,
  CategoryComparison,
  OverallComparison,
} from './engines/benchmarks'
