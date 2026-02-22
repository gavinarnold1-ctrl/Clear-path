'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'

interface FundExpense {
  name: string
  annualAmount: number
  funded: number
  monthlySetAside: number
  currentSetAside: number
}

interface Props {
  expense: FundExpense
  isOpen: boolean
  onClose: () => void
  onSubmit: (amount: number) => void
}

export default function FundExpenseModal({ expense, isOpen, onClose, onSubmit }: Props) {
  const remaining = expense.annualAmount - expense.funded
  const catchUp = Math.max(0, remaining - expense.currentSetAside)
  const [amount, setAmount] = useState(expense.currentSetAside.toFixed(2))
  const [error, setError] = useState('')

  if (!isOpen) return null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const val = parseFloat(amount)
    if (!val || val <= 0) {
      setError('Amount must be positive')
      return
    }
    setError('')
    onSubmit(val)
  }

  function quickFill(val: number) {
    setAmount(val.toFixed(2))
    setError('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900">
          Add Funds to {expense.name}
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          {formatCurrency(expense.funded)} of {formatCurrency(expense.annualAmount)} funded
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="fund-amount" className="block text-sm font-medium text-gray-700">
              Amount
            </label>
            <input
              id="fund-amount"
              type="number"
              step="0.01"
              min="0.01"
              className="input mt-1 w-full"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value)
                setError('')
              }}
            />
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
          </div>

          <div className="flex flex-wrap gap-2">
            {expense.currentSetAside > 0 && (
              <button
                type="button"
                onClick={() => quickFill(expense.currentSetAside)}
                className="btn-secondary px-3 py-1 text-xs"
              >
                This month ({formatCurrency(expense.currentSetAside)})
              </button>
            )}
            {catchUp > 0 && catchUp !== expense.currentSetAside && (
              <button
                type="button"
                onClick={() => quickFill(catchUp)}
                className="btn-secondary px-3 py-1 text-xs"
              >
                Catch up ({formatCurrency(catchUp)})
              </button>
            )}
            {remaining > 0 && remaining !== expense.currentSetAside && (
              <button
                type="button"
                onClick={() => quickFill(remaining)}
                className="btn-secondary px-3 py-1 text-xs"
              >
                Fund fully ({formatCurrency(remaining)})
              </button>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm">
              Cancel
            </button>
            <button type="submit" className="btn-primary px-4 py-2 text-sm">
              Add Funds
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
