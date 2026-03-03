import Link from 'next/link'
import type { ValueSummary } from '@/lib/value-tracker'
import { formatCurrency } from '@/lib/utils'

export default function ValueTracker({ value }: { value: ValueSummary }) {
  if (value.totalIdentified === 0) {
    return (
      <div className="card flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-fjord">Savings identified by Oversikt</p>
          <p className="mt-1 text-xs text-stone">
            Generate your first AI review to discover savings opportunities.
          </p>
        </div>
        <Link
          href="/monthly-review"
          className="shrink-0 rounded-button bg-frost px-3 py-1.5 text-sm font-medium text-fjord hover:bg-mist"
        >
          Monthly Review
        </Link>
      </div>
    )
  }

  const sinceLabel = value.since
    ? value.since.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : ''

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-fjord">Savings identified by Oversikt</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-xl font-semibold text-pine">
              {formatCurrency(value.totalIdentified)}
            </span>
            {sinceLabel && (
              <span className="text-xs text-stone">since {sinceLabel}</span>
            )}
          </div>
        </div>
        <Link
          href="/monthly-review"
          className="shrink-0 rounded-button bg-frost px-3 py-1.5 text-sm font-medium text-fjord hover:bg-mist"
        >
          View details
        </Link>
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-stone">
        <span>
          {value.insightCount} insight{value.insightCount !== 1 ? 's' : ''} with estimated savings
        </span>
        {value.roi > 0 && (
          <span className="font-medium text-pine">
            {value.roi}x your subscription cost
          </span>
        )}
      </div>
    </div>
  )
}
