import Link from 'next/link'
import type { ValueSummary } from '@/lib/value-tracker'
import { formatCurrency } from '@/lib/utils'

export default function ValueTracker({ value }: { value: ValueSummary }) {
  const hasCardBenefits = value.perkReimbursements > 0 || value.cardBenefitCreditsUsed > 0
  const hasAnySavings = value.totalActioned > 0 || value.perkReimbursements > 0
  const hasPotential = value.totalIdentified > value.totalActioned

  // Nothing at all — prompt to generate first review
  if (value.totalIdentified === 0 && !hasCardBenefits) {
    return (
      <div className="card flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-fjord">Savings confirmed</p>
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
          <p className="text-sm font-medium text-fjord">Savings confirmed</p>
          {hasAnySavings ? (
            <>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-semibold text-pine">
                  {formatCurrency(value.totalActioned + value.perkReimbursements)}
                </span>
                {sinceLabel && (
                  <span className="text-xs text-stone">since {sinceLabel}</span>
                )}
              </div>
              {hasPotential && (
                <p className="mt-1 text-xs text-stone">
                  + {formatCurrency(value.totalIdentified - value.totalActioned)} more identified
                </p>
              )}
            </>
          ) : (
            <p className="mt-1 text-sm text-stone">
              {formatCurrency(value.totalIdentified)} in potential savings identified.{' '}
              <span className="text-pine">Complete an insight to start tracking.</span>
            </p>
          )}
        </div>
        <Link
          href="/monthly-review"
          className="shrink-0 rounded-button bg-frost px-3 py-1.5 text-sm font-medium text-fjord hover:bg-mist"
        >
          View details
        </Link>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-stone">
        {value.actionedCount > 0 && (
          <span>
            {value.actionedCount} insight{value.actionedCount !== 1 ? 's' : ''} completed
          </span>
        )}
        {hasCardBenefits && (
          <Link href="/accounts/benefits" className="hover:text-fjord">
            {value.perkReimbursements > 0 && (
              <span>{formatCurrency(value.perkReimbursements)} in card perks (YTD)</span>
            )}
            {value.cardBenefitCreditsUsed > 0 && value.perkReimbursements === 0 && (
              <span>{formatCurrency(value.cardBenefitCreditsUsed)} in credits used</span>
            )}
          </Link>
        )}
        {value.roi > 0 && (
          <span className="font-medium text-pine">
            {value.roi}x your subscription cost
          </span>
        )}
      </div>
    </div>
  )
}
