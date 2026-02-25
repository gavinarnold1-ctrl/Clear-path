import { formatCurrency } from '@/lib/utils'
import type { CategoryBreakdownItem } from '@/types/insights'

interface SpendingComparisonProps {
  categories: CategoryBreakdownItem[]
  months: number
}

export default function SpendingComparison({ categories, months }: SpendingComparisonProps) {
  const withBenchmarks = categories.filter((c) => c.benchmark)

  if (withBenchmarks.length === 0) {
    return null
  }

  const maxAmount = Math.max(
    ...withBenchmarks.flatMap((c) => [c.total / months, c.benchmark!.median])
  )

  return (
    <div className="card border-mist/60 bg-frost/50">
      <h2 className="mb-1 text-sm font-semibold text-stone">Spending vs National Median</h2>
      <p className="mb-4 text-xs text-stone">
        Based on BLS Consumer Expenditure data. These national medians don&apos;t account for
        your household size, location, or income &mdash; treat as a rough reference only.
        Personalized benchmarks coming in a future update.
      </p>

      <div className="space-y-4">
        {withBenchmarks.map((c) => {
          const monthlyAvg = c.total / months
          const benchmark = c.benchmark!
          const userPct = Math.round((monthlyAvg / maxAmount) * 100)
          const benchmarkPct = Math.round((benchmark.median / maxAmount) * 100)
          const isOver = monthlyAvg > benchmark.median

          return (
            <div key={c.category}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-fjord">{c.category}</span>
                <span className="text-xs text-stone">
                  {formatCurrency(monthlyAvg)}/mo
                </span>
              </div>

              {/* Your spending bar */}
              <div className="flex items-center gap-2">
                <span className="w-12 text-right text-xs text-stone">You</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-mist">
                  <div
                    className={`h-full rounded-full ${isOver ? 'bg-ember' : 'bg-pine'}`}
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
                    className="h-full rounded-full bg-stone/40"
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
