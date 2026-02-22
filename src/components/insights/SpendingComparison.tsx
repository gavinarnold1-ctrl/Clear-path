import { formatCurrency } from '@/lib/utils'
import type { CategoryBreakdownItem } from '@/types/insights'

interface SpendingComparisonProps {
  categories: CategoryBreakdownItem[]
  months: number
}

const RATING_COLORS: Record<string, string> = {
  excellent: 'bg-green-500',
  good: 'bg-green-400',
  average: 'bg-amber-400',
  high: 'bg-orange-400',
  excessive: 'bg-red-500',
}

const RATING_LABELS: Record<string, string> = {
  excellent: 'Excellent',
  good: 'Good',
  average: 'Average',
  high: 'High',
  excessive: 'Excessive',
}

export default function SpendingComparison({ categories, months }: SpendingComparisonProps) {
  const withBenchmarks = categories.filter((c) => c.benchmark)

  if (withBenchmarks.length === 0) {
    return (
      <div className="card">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Spending vs Benchmark</h2>
        <p className="text-sm text-gray-400">
          No benchmark data available for your current categories.
        </p>
      </div>
    )
  }

  const maxAmount = Math.max(
    ...withBenchmarks.flatMap((c) => [c.total / months, c.benchmark!.median])
  )

  return (
    <div className="card">
      <h2 className="mb-4 text-base font-semibold text-gray-900">Spending vs Benchmark</h2>
      <p className="mb-4 text-xs text-gray-400">Monthly averages over {months} months</p>

      <div className="space-y-4">
        {withBenchmarks.map((c) => {
          const monthlyAvg = c.total / months
          const benchmark = c.benchmark!
          const userPct = Math.round((monthlyAvg / maxAmount) * 100)
          const benchmarkPct = Math.round((benchmark.median / maxAmount) * 100)
          const barColor = RATING_COLORS[benchmark.rating] ?? 'bg-gray-400'

          return (
            <div key={c.category}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">{c.category}</span>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-xs font-medium text-white ${barColor}`}
                  >
                    {RATING_LABELS[benchmark.rating] ?? benchmark.rating}
                  </span>
                </div>
              </div>

              {/* Your spending bar */}
              <div className="flex items-center gap-2">
                <span className="w-12 text-right text-xs text-gray-400">You</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full rounded-full ${barColor}`}
                    style={{ width: `${userPct}%` }}
                  />
                </div>
                <span className="w-20 text-right text-xs text-gray-600">
                  {formatCurrency(monthlyAvg)}
                </span>
              </div>

              {/* Benchmark bar */}
              <div className="flex items-center gap-2">
                <span className="w-12 text-right text-xs text-gray-400">Median</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-gray-300"
                    style={{ width: `${benchmarkPct}%` }}
                  />
                </div>
                <span className="w-20 text-right text-xs text-gray-400">
                  {formatCurrency(benchmark.median)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
