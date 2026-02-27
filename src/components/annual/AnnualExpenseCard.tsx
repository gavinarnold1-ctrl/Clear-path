'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ProgressBar from '@/components/ui/ProgressBar'
import { formatCurrency, budgetProgress } from '@/lib/utils'
import { formatMonthName } from '@/lib/budget-engine'
import FundExpenseModal from './FundExpenseModal'
import MarkSpentModal from './MarkSpentModal'
import LinkTransactionModal from './LinkTransactionModal'

interface AnnualExpenseData {
  id: string
  name: string
  annualAmount: number
  dueMonth: number
  dueYear: number
  isRecurring: boolean
  monthlySetAside: number
  funded: number
  status: string
  actualCost: number | null
  actualDate: string | null
  notes: string | null
  monthsRemaining: number
  currentSetAside: number
  computedStatus: string
  budget: {
    id: string
    categoryId: string | null
    category: { name: string; icon: string | null } | null
  }
}

interface Props {
  expense: AnnualExpenseData
  affordableMonthly?: number
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  overdue: { label: 'OVERDUE', className: 'border-ember/30 bg-ember/10 text-ember' },
  urgent: { label: 'URGENT', className: 'border-ember/30 bg-ember/10 text-ember' },
  behind: { label: 'BEHIND', className: 'border-birch/30 bg-birch/10 text-birch' },
  planned: { label: 'ON TRACK', className: 'border-lichen/30 bg-lichen/10 text-lichen' },
  funded: { label: 'FUNDED', className: 'border-pine/30 bg-pine/10 text-pine' },
  spent: { label: 'SPENT', className: 'border-mist bg-snow text-stone' },
  overspent: { label: 'OVERSPENT', className: 'border-ember/30 bg-ember/10 text-ember' },
}

export default function AnnualExpenseCard({ expense, affordableMonthly }: Props) {
  const router = useRouter()
  const [fundOpen, setFundOpen] = useState(false)
  const [spentOpen, setSpentOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const pct = budgetProgress(expense.funded, expense.annualAmount)
  const isCompleted = expense.status === 'spent' || expense.status === 'overspent'
  const badgeKey = isCompleted ? expense.status : expense.computedStatus
  const badge = STATUS_BADGES[badgeKey] ?? STATUS_BADGES.planned
  const icon = expense.budget.category?.icon

  async function handleFund(amount: number) {
    setLoading(true)
    try {
      const res = await fetch(`/api/budgets/annual/${expense.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fund', amount }),
      })
      if (!res.ok) throw new Error('Failed to add funds')
      router.refresh()
    } finally {
      setLoading(false)
      setFundOpen(false)
    }
  }

  async function handleMarkSpent(actualCost: number, actualDate: Date, notes?: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/budgets/annual/${expense.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'markSpent',
          actualCost,
          actualDate: actualDate.toISOString(),
          notes,
        }),
      })
      if (!res.ok) throw new Error('Failed to mark as spent')
      router.refresh()
    } finally {
      setLoading(false)
      setSpentOpen(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${expense.name}"? This cannot be undone.`)) return
    setLoading(true)
    try {
      const res = await fetch(`/api/budgets/annual/${expense.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className={`card ${isCompleted ? 'opacity-70' : ''}`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-semibold text-fjord">
              {icon && <span className="text-lg">{icon}</span>}
              {expense.budget.categoryId ? (
                <Link
                  href={`/transactions?categoryId=${expense.budget.categoryId}`}
                  className={`hover:text-midnight hover:underline ${isCompleted ? 'line-through' : ''}`}
                >
                  {expense.name}
                </Link>
              ) : (
                <span className={isCompleted ? 'line-through' : ''}>{expense.name}</span>
              )}
              {expense.isRecurring && (
                <span className="rounded bg-mist px-1.5 py-0.5 text-[10px] font-medium text-stone">
                  yearly
                </span>
              )}
            </p>
            <p className="mt-0.5 text-sm text-stone">
              {formatCurrency(expense.annualAmount)} planned &middot; Due{' '}
              {formatMonthName(expense.dueMonth)} {expense.dueYear}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}
          >
            {badge.label}
          </span>
        </div>

        {/* Progress */}
        <div className="mt-3">
          <ProgressBar value={pct} />
          <div className="mt-1 flex justify-between text-sm">
            <span className="text-stone">
              {formatCurrency(expense.funded)} / {formatCurrency(expense.annualAmount)}
            </span>
            <span className="font-medium text-stone">{pct}%</span>
          </div>
        </div>

        {/* Details */}
        {isCompleted ? (
          <div className="mt-3 text-sm text-stone">
            {expense.actualCost !== null && (
              <p>
                {formatCurrency(expense.actualCost)} actual
                {expense.actualCost !== expense.annualAmount && (
                  <span>
                    {' '}
                    (vs {formatCurrency(expense.annualAmount)} planned &mdash;{' '}
                    {expense.actualCost < expense.annualAmount ? (
                      <span className="text-pine">
                        saved {formatCurrency(expense.annualAmount - expense.actualCost)}
                      </span>
                    ) : (
                      <span className="text-ember">
                        over by {formatCurrency(expense.actualCost - expense.annualAmount)}
                      </span>
                    )}
                    )
                  </span>
                )}
              </p>
            )}
            {expense.actualDate && (
              <p className="text-xs text-stone">
                Completed{' '}
                {new Date(expense.actualDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            )}
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-stone">
              {formatCurrency(expense.currentSetAside)}/mo needed &middot;{' '}
              {expense.monthsRemaining} month{expense.monthsRemaining !== 1 ? 's' : ''} remaining
            </p>
            {affordableMonthly !== undefined &&
              affordableMonthly < expense.currentSetAside &&
              expense.monthsRemaining > 0 && (() => {
                const remaining = expense.annualAmount - expense.funded
                const projectedFunding = affordableMonthly * expense.monthsRemaining
                const shortfall = remaining - projectedFunding
                return shortfall > 0 ? (
                  <p className="mt-1 text-xs font-medium text-ember">
                    At current pace, you&apos;ll be {formatCurrency(shortfall)} short by the due date
                  </p>
                ) : null
              })()}
          </>
        )}

        {/* Notes */}
        {expense.notes && (
          <p className="mt-2 text-xs text-stone italic">{expense.notes}</p>
        )}

        {/* Actions */}
        <div className="mt-3 flex items-center gap-2 border-t border-mist pt-3">
          {isCompleted ? (
            <span className="text-xs font-medium text-pine">Completed &#x2713;</span>
          ) : (
            <>
              <button
                onClick={() => setFundOpen(true)}
                disabled={loading}
                className="btn-primary px-3 py-1 text-xs"
              >
                Add Funds
              </button>
              <button
                onClick={() => setLinkOpen(true)}
                disabled={loading}
                className="btn-secondary px-3 py-1 text-xs"
              >
                Link Transaction
              </button>
              <button
                onClick={() => setSpentOpen(true)}
                disabled={loading}
                className="btn-secondary px-3 py-1 text-xs"
              >
                Mark as Spent
              </button>
            </>
          )}
          <button
            onClick={handleDelete}
            disabled={loading}
            className="ml-auto text-xs text-stone hover:text-ember"
          >
            Delete
          </button>
        </div>
      </div>

      <FundExpenseModal
        expense={expense}
        isOpen={fundOpen}
        onClose={() => setFundOpen(false)}
        onSubmit={handleFund}
      />
      <MarkSpentModal
        expense={expense}
        isOpen={spentOpen}
        onClose={() => setSpentOpen(false)}
        onSubmit={handleMarkSpent}
      />
      <LinkTransactionModal
        expenseId={expense.id}
        expenseName={expense.name}
        isOpen={linkOpen}
        onClose={() => setLinkOpen(false)}
        onLinked={() => router.refresh()}
      />
    </>
  )
}
