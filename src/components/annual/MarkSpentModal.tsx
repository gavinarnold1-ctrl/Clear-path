'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'

interface MarkSpentExpense {
  name: string
  annualAmount: number
}

interface Props {
  expense: MarkSpentExpense
  isOpen: boolean
  onClose: () => void
  onSubmit: (actualCost: number, date: Date, notes?: string) => void
}

export default function MarkSpentModal({ expense, isOpen, onClose, onSubmit }: Props) {
  const [actualCost, setActualCost] = useState(expense.annualAmount.toFixed(2))
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  if (!isOpen) return null

  const costVal = parseFloat(actualCost) || 0
  const diff = costVal - expense.annualAmount

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!costVal || costVal <= 0) {
      setError('Actual cost must be positive')
      return
    }
    if (!date) {
      setError('Date is required')
      return
    }
    setError('')
    onSubmit(costVal, new Date(date), notes.trim() || undefined)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl bg-frost p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-fjord">
          Record Expense: {expense.name}
        </h3>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="actual-cost" className="block text-sm font-medium text-fjord">
              Actual Cost
            </label>
            <input
              id="actual-cost"
              type="number"
              step="0.01"
              min="0.01"
              className="input mt-1 w-full"
              value={actualCost}
              onChange={(e) => {
                setActualCost(e.target.value)
                setError('')
              }}
            />
          </div>

          <div>
            <label htmlFor="spent-date" className="block text-sm font-medium text-fjord">
              Date
            </label>
            <input
              id="spent-date"
              type="date"
              className="input mt-1 w-full"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="spent-notes" className="block text-sm font-medium text-fjord">
              Notes (optional)
            </label>
            <textarea
              id="spent-notes"
              className="input mt-1 w-full"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Comparison */}
          <div className="rounded-lg bg-snow p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-stone">Planned:</span>
              <span>{formatCurrency(expense.annualAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone">Actual:</span>
              <span>{formatCurrency(costVal)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-mist pt-1">
              <span className="text-stone">Difference:</span>
              <span
                className={
                  diff > 0
                    ? 'font-medium text-ember'
                    : diff < 0
                      ? 'font-medium text-pine'
                      : 'text-stone'
                }
              >
                {diff > 0 ? '+' : ''}
                {formatCurrency(diff)}
              </span>
            </div>
          </div>

          {error && <p className="text-xs text-ember">{error}</p>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm">
              Cancel
            </button>
            <button type="submit" className="btn-primary px-4 py-2 text-sm">
              Mark as Spent
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
