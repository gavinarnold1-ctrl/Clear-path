'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ProgressBar from '@/components/ui/ProgressBar'
import { formatCurrency, budgetProgress } from '@/lib/utils'
import { formatMonthName } from '@/lib/budget-engine'
import FundExpenseModal from './FundExpenseModal'
import MarkSpentModal from './MarkSpentModal'

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
    category: { name: string; icon: string | null } | null
  }
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  overdue: { label: 'OVERDUE', className: 'border-red-200 bg-red-50 text-red-700' },
  urgent: { label: 'URGENT', className: 'border-red-200 bg-red-50 text-red-700' },
  behind: { label: 'BEHIND', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  planned: { label: 'ON TRACK', className: 'border-purple-200 bg-purple-50 text-purple-700' },
  funded: { label: 'FUNDED', className: 'border-green-200 bg-green-50 text-green-700' },
  spent: { label: 'SPENT', className: 'border-gray-200 bg-gray-50 text-gray-500' },
  overspent: { label: 'OVERSPENT', className: 'border-red-200 bg-red-50 text-red-700' },
}

export default function AnnualExpenseCard({ expense }: { expense: AnnualExpenseData }) {
  const router = useRouter()
  const [fundOpen, setFundOpen] = useState(false)
  const [spentOpen, setSpentOpen] = useState(false)
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
            <p className="flex items-center gap-2 font-semibold text-gray-900">
              {icon && <span className="text-lg">{icon}</span>}
              <span className={isCompleted ? 'line-through' : ''}>{expense.name}</span>
              {expense.isRecurring && (
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                  yearly
                </span>
              )}
            </p>
            <p className="mt-0.5 text-sm text-gray-500">
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
            <span className="text-gray-500">
              {formatCurrency(expense.funded)} / {formatCurrency(expense.annualAmount)}
            </span>
            <span className="font-medium text-gray-600">{pct}%</span>
          </div>
        </div>

        {/* Details */}
        {isCompleted ? (
          <div className="mt-3 text-sm text-gray-500">
            {expense.actualCost !== null && (
              <p>
                {formatCurrency(expense.actualCost)} actual
                {expense.actualCost !== expense.annualAmount && (
                  <span>
                    {' '}
                    (vs {formatCurrency(expense.annualAmount)} planned &mdash;{' '}
                    {expense.actualCost < expense.annualAmount ? (
                      <span className="text-green-600">
                        saved {formatCurrency(expense.annualAmount - expense.actualCost)}
                      </span>
                    ) : (
                      <span className="text-red-600">
                        over by {formatCurrency(expense.actualCost - expense.annualAmount)}
                      </span>
                    )}
                    )
                  </span>
                )}
              </p>
            )}
            {expense.actualDate && (
              <p className="text-xs text-gray-400">
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
          <p className="mt-2 text-sm text-gray-500">
            {formatCurrency(expense.currentSetAside)}/mo needed &middot;{' '}
            {expense.monthsRemaining} month{expense.monthsRemaining !== 1 ? 's' : ''} remaining
          </p>
        )}

        {/* Notes */}
        {expense.notes && (
          <p className="mt-2 text-xs text-gray-400 italic">{expense.notes}</p>
        )}

        {/* Actions */}
        <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
          {isCompleted ? (
            <span className="text-xs font-medium text-green-600">Completed &#x2713;</span>
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
            className="ml-auto text-xs text-gray-400 hover:text-red-500"
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
    </>
  )
}
