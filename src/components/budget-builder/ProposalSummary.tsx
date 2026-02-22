'use client'

import { formatCurrency } from '@/lib/utils'
import type { BudgetProposal } from '@/lib/budget-builder'
import type { ProfileSummary } from './BudgetBuilderCTA'

interface Props {
  proposal: BudgetProposal
  profileSummary: ProfileSummary
}

export default function ProposalSummary({ proposal, profileSummary }: Props) {
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
      ? 'text-green-600'
      : savingsRate > 5
        ? 'text-amber-600'
        : 'text-red-600'

  const barSegments = [
    { label: 'Fixed', amount: totalFixed, color: 'bg-blue-500' },
    { label: 'Flexible', amount: totalFlexible, color: 'bg-amber-500' },
    { label: 'Annual', amount: totalAnnualMonthly, color: 'bg-purple-500' },
    { label: 'Remaining', amount: Math.max(0, trueRemaining), color: 'bg-green-400' },
  ]
  const total = profileSummary.totalMonthlyIncome || 1

  return (
    <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-5">
      <h3 className="mb-4 text-sm font-semibold text-gray-900">Budget Summary</h3>

      {/* Stacked bar */}
      <div className="mb-4 flex h-4 overflow-hidden rounded-full bg-gray-200">
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
            <span className="text-gray-600">{seg.label}</span>
            <span className="font-medium text-gray-900">{formatCurrency(seg.amount)}</span>
          </div>
        ))}
      </div>

      {/* Numbers grid */}
      <div className="grid grid-cols-2 gap-3 border-t border-gray-200 pt-4 sm:grid-cols-4">
        <div>
          <p className="text-xs font-medium text-gray-500">Income</p>
          <p className="text-lg font-semibold text-gray-900">
            {formatCurrency(profileSummary.totalMonthlyIncome)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500">Total Budgeted</p>
          <p className="text-lg font-semibold text-gray-900">{formatCurrency(totalCommitted)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500">True Remaining</p>
          <p className={`text-lg font-bold ${remainingColor}`}>{formatCurrency(trueRemaining)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500">Savings Rate</p>
          <p className={`text-lg font-bold ${remainingColor}`}>{savingsRate.toFixed(1)}%</p>
        </div>
      </div>

      {/* AI commentary */}
      {proposal.summary.commentary && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-600">{proposal.summary.commentary}</p>
        </div>
      )}

      {/* Data coverage note */}
      <p className="mt-3 text-xs text-gray-400">
        Based on {profileSummary.totalTransactions} transactions over {profileSummary.monthsOfData}{' '}
        month{profileSummary.monthsOfData !== 1 ? 's' : ''}
      </p>
    </div>
  )
}
