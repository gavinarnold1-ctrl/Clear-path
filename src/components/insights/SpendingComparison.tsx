import { formatCurrency } from '@/lib/utils'
import type { CategoryBreakdownItem } from '@/types/insights'

interface SpendingComparisonProps {
  categories: CategoryBreakdownItem[]
  months: number
}

const RATING_COLORS: Record<string, string> = {
  excellent: 'bg-pine',
  good: 'bg-lichen',
  average: 'bg-birch',
  high: 'bg-ember/70',
  excessive: 'bg-ember',
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
        <h2 className="mb-4 text-base font-semibold text-fjord">Spending vs Benchmark</h2>
        <p className="text-sm text-stone">
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
      <h2 className="mb-4 text-base font-semibold text-fjord">Spending vs Benchmark</h2>
      <p className="mb-4 text-xs text-stone">Monthly averages over {months} months</p>

      <div className="space-y-4">
        {withBenchmarks.map((c) => {
          const monthlyAvg = c.total / months
          const benchmark = c.benchmark!
          const userPct = Math.round((monthlyAvg / maxAmount) * 100)
          const benchmarkPct = Math.round((benchmark.median / maxAmount) * 100)
          const barColor = RATING_COLORS[benchmark.rating] ?? 'bg-stone'

          return (
            <div key={c.category}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-fjord">{c.category}</span>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-xs font-medium text-snow ${barColor}`}
                  >
                    {RATING_LABELS[benchmark.rating] ?? benchmark.rating}
                  </span>
                </div>
              </div>

              {/* Your spending bar */}
              <div className="flex items-center gap-2">
                <span className="w-12 text-right text-xs text-stone">You</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-mist">
                  <div
                    className={`h-full rounded-full ${barColor}`}
                    style={{ width: `${userPct}%` }}
                  />
                </div>
                <span className="w-20 text-right text-xs text-stone">
                  {formatCurrency(monthlyAvg)}
                </span>
              </div>

              {/* Benchmark bar */}
              <div className="flex items-center gap-2">
                <span className="w-12 text-right text-xs text-stone">Median</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-mist">
                  <div
                    className="h-full rounded-full bg-mist"
                    style={{ width: `${benchmarkPct}%` }}
                  />
                </div>
                <span className="w-20 text-right text-xs text-stone">
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
