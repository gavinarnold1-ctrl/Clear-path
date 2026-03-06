import type { BudgetBenchmarkComparison } from '@/lib/budget-benchmarks'
import { formatCurrency } from '@/lib/utils'

interface Props {
  benchmark: BudgetBenchmarkComparison
  goalAware?: boolean  // If true, frame in terms of goal savings potential
  primaryGoal?: string
}

export default function BenchmarkBar({ benchmark, goalAware, primaryGoal }: Props) {
  const { status, percentOfBenchmark, blsMonthlyAvg, delta } = benchmark

  const statusColors = {
    under: 'text-pine',
    at: 'text-stone',
    over: 'text-ember',
    way_over: 'text-red-600',
  }

  return (
    <div className="mt-2 flex items-center gap-2 text-xs">
      <span className="text-stone">
        vs bracket avg {formatCurrency(blsMonthlyAvg)}
      </span>
      <span className={`font-medium ${statusColors[status]}`}>
        {percentOfBenchmark}%
      </span>
      {delta > 0 && goalAware && (primaryGoal === 'save_more' || primaryGoal === 'pay_off_debt') && (
        <span className="text-ember">
          +{formatCurrency(delta)}/mo potential savings
        </span>
      )}
    </div>
  )
}
