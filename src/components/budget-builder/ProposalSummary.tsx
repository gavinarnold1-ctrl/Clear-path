'use client'

import { formatCurrency } from '@/lib/utils'
import type { BudgetProposal } from '@/lib/budget-builder'
import type { ProfileSummary, GoalSummary } from './BudgetBuilderCTA'

const GOAL_TARGETS: Record<string, { metric: string; threshold: number; unit: string }> = {
  save_more: { metric: 'Savings Rate', threshold: 20, unit: '%' },
  pay_off_debt: { metric: 'Extra for Debt', threshold: 0, unit: '$' },
  build_wealth: { metric: 'Savings Rate', threshold: 25, unit: '%' },
  spend_smarter: { metric: 'Savings Rate', threshold: 15, unit: '%' },
  gain_visibility: { metric: 'Savings Rate', threshold: 10, unit: '%' },
}

interface Props {
  proposal: BudgetProposal
  profileSummary: ProfileSummary
  goalSummary: GoalSummary | null
}

export default function ProposalSummary({ proposal, profileSummary, goalSummary }: Props) {
  const totalFixed = proposal.fixed.reduce((sum, i) => sum + i.amount, 0)
  const totalFlexible = proposal.flexible.reduce((sum, i) => sum + i.amount, 0)
  const totalAnnualMonthly = proposal.annual.reduce((sum, i) => sum + i.annualAmount / 12, 0)
  const totalCommitted = totalFixed + totalFlexible + totalAnnualMonthly
  const trueRemaining = profileSummary.totalMonthlyIncome - totalCommitted
  const savingsRate =
    profileSummary.totalMonthlyIncome > 0
      ? (trueRemaining / profileSummary.totalMonthlyIncome) * 100
      : 0

  const remainingColor =
    savingsRate > 20
      ? 'text-pine'
      : savingsRate > 5
        ? 'text-birch'
        : 'text-ember'

  const barSegments = [
    { label: 'Fixed', amount: totalFixed, color: 'bg-fjord' },
    { label: 'Flexible', amount: totalFlexible, color: 'bg-birch' },
    { label: 'Annual', amount: totalAnnualMonthly, color: 'bg-lichen' },
    { label: 'Remaining', amount: Math.max(0, trueRemaining), color: 'bg-pine' },
  ]
  const total = profileSummary.totalMonthlyIncome || 1

  return (
    <div className="rounded-xl border-2 border-mist bg-snow p-5">
      <h3 className="mb-4 text-sm font-semibold text-fjord">Budget Summary</h3>

      {/* Stacked bar */}
      <div className="mb-4 flex h-4 overflow-hidden rounded-full bg-mist">
        {barSegments.map((seg) => (
          <div
            key={seg.label}
            className={`${seg.color} transition-all`}
            style={{ width: `${Math.max(0, (seg.amount / total) * 100)}%` }}
            title={`${seg.label}: ${formatCurrency(seg.amount)}`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mb-4 flex flex-wrap gap-3 text-xs">
        {barSegments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${seg.color}`} />
            <span className="text-stone">{seg.label}</span>
            <span className="font-medium text-fjord">{formatCurrency(seg.amount)}</span>
          </div>
        ))}
      </div>

      {/* Numbers grid */}
      <div className="grid grid-cols-2 gap-3 border-t border-mist pt-4 sm:grid-cols-4">
        <div>
          <p className="text-xs font-medium text-stone">Income</p>
          <p className="text-lg font-semibold text-fjord">
            {formatCurrency(profileSummary.totalMonthlyIncome)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-stone">Total Budgeted</p>
          <p className="text-lg font-semibold text-fjord">{formatCurrency(totalCommitted)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-stone">True Remaining</p>
          <p className={`text-lg font-bold ${remainingColor}`}>{formatCurrency(trueRemaining)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-stone">Savings Rate</p>
          <p className={`text-lg font-bold ${remainingColor}`}>{savingsRate.toFixed(1)}%</p>
        </div>
      </div>

      {/* Goal target indicator */}
      {goalSummary && (() => {
        const target = GOAL_TARGETS[goalSummary.primaryGoal]
        if (!target) return null
        const meetsTarget = target.unit === '%' ? savingsRate >= target.threshold : trueRemaining >= target.threshold
        return (
          <div className={`mt-4 flex items-center gap-2 rounded-lg border px-3 py-2 ${meetsTarget ? 'border-pine/30 bg-pine/5' : 'border-birch/50 bg-birch/10'}`}>
            <span className="text-sm">{meetsTarget ? '\u2713' : '\u2192'}</span>
            <p className="text-xs text-fjord">
              <span className="font-medium">{goalSummary.goalLabel}:</span>{' '}
              {meetsTarget
                ? `This budget meets your ${target.metric.toLowerCase()} target of ${target.threshold}${target.unit}`
                : `Your ${target.metric.toLowerCase()} is ${savingsRate.toFixed(1)}% — aim for ${target.threshold}${target.unit} to hit your goal`}
            </p>
          </div>
        )
      })()}

      {/* AI commentary */}
      {proposal.summary.commentary && (
        <div className="mt-4 rounded-lg border border-mist bg-frost p-3">
          <p className="text-xs text-stone">{proposal.summary.commentary}</p>
        </div>
      )}

      {/* Data coverage note */}
      <p className="mt-3 text-xs text-stone">
        Based on {profileSummary.totalTransactions} transactions over {profileSummary.monthsOfData}{' '}
        month{profileSummary.monthsOfData !== 1 ? 's' : ''}
      </p>
    </div>
  )
}
