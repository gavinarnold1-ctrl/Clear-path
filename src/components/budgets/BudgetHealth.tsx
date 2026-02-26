'use client'

import { formatCurrency } from '@/lib/utils'

interface Props {
  expectedIncome: number
  actualIncome: number
  expectedExpenses: number
  actualExpenses: number
  fixedPaid: number
  fixedTotal: number
  flexOnTrack: number
  flexTotal: number
  flexOverBudget: number
  monthLabel: string
}

function ComparisonBar({
  label,
  expected,
  actual,
  color,
}: {
  label: string
  expected: number
  actual: number
  color: 'income' | 'expense'
}) {
  const maxVal = Math.max(expected, actual, 1)
  const expectedPct = (expected / maxVal) * 100
  const actualPct = (actual / maxVal) * 100
  const isOver = actual > expected && expected > 0
  const overflowPct = isOver ? ((actual - expected) / maxVal) * 100 : 0
  const normalPct = isOver ? expectedPct : actualPct

  const barColor = color === 'income' ? 'bg-pine' : 'bg-fjord'
  const onTrack = expected > 0 && actual <= expected
  const incomeOnTrack = color === 'income' && expected > 0 && actual >= expected * 0.9

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-medium text-fjord">{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-fjord">
            {formatCurrency(actual)}
          </span>
          {color === 'income' && incomeOnTrack && (
            <span className="text-xs font-medium text-pine">on track</span>
          )}
          {color === 'expense' && onTrack && (
            <span className="text-xs font-medium text-pine">under budget</span>
          )}
          {isOver && color === 'expense' && (
            <span className="text-xs font-medium text-ember">over budget</span>
          )}
        </div>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-bar bg-mist/50">
        {/* Expected (muted) */}
        <div
          className="absolute inset-y-0 left-0 rounded-bar bg-mist"
          style={{ width: `${expectedPct}%` }}
        />
        {/* Actual (overlaid) */}
        <div
          className={`absolute inset-y-0 left-0 rounded-bar ${barColor}`}
          style={{ width: `${normalPct}%` }}
        />
        {/* Overflow in ember */}
        {isOver && (
          <div
            className="absolute inset-y-0 rounded-bar bg-ember"
            style={{ left: `${expectedPct}%`, width: `${overflowPct}%` }}
          />
        )}
      </div>
      <p className="mt-1 text-xs text-stone">
        Expected: {formatCurrency(expected)}
      </p>
    </div>
  )
}

export default function BudgetHealth({
  expectedIncome,
  actualIncome,
  expectedExpenses,
  actualExpenses,
  fixedPaid,
  fixedTotal,
  flexOnTrack,
  flexTotal,
  flexOverBudget,
  monthLabel,
}: Props) {
  return (
    <div className="card mb-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-stone">
        Budget Health — {monthLabel}
      </h2>

      <div className="space-y-5">
        <ComparisonBar
          label="Income"
          expected={expectedIncome}
          actual={actualIncome}
          color="income"
        />
        <ComparisonBar
          label="Expenses"
          expected={expectedExpenses}
          actual={actualExpenses}
          color="expense"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span className="text-stone">
          Fixed Bills{' '}
          <span className="font-semibold text-fjord">
            {fixedPaid}/{fixedTotal}
          </span>{' '}
          paid
        </span>
        <span className="text-stone">
          Flexible{' '}
          <span className={`font-semibold ${flexOverBudget > 0 ? 'text-ember' : 'text-pine'}`}>
            {flexOnTrack}/{flexTotal}
          </span>{' '}
          on track
          {flexOverBudget > 0 && (
            <span className="text-ember"> ({flexOverBudget} over)</span>
          )}
        </span>
      </div>
    </div>
  )
}
