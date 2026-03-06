'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/Button'

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
        className="w-full max-w-md rounded-xl bg-frost p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-fjord">
          Add Funds to {expense.name}
        </h3>
        <p className="mt-1 text-sm text-stone">
          {formatCurrency(expense.funded)} of {formatCurrency(expense.annualAmount)} funded
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="fund-amount" className="block text-sm font-medium text-fjord">
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
            {error && <p className="mt-1 text-xs text-ember">{error}</p>}
          </div>

          <div className="flex flex-wrap gap-2">
            {expense.currentSetAside > 0 && (
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => quickFill(expense.currentSetAside)}
              >
                This month ({formatCurrency(expense.currentSetAside)})
              </Button>
            )}
            {catchUp > 0 && catchUp !== expense.currentSetAside && (
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => quickFill(catchUp)}
              >
                Catch up ({formatCurrency(catchUp)})
              </Button>
            )}
            {remaining > 0 && remaining !== expense.currentSetAside && (
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => quickFill(remaining)}
              >
                Fund fully ({formatCurrency(remaining)})
              </Button>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              Add Funds
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
