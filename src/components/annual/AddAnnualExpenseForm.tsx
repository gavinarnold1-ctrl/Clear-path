'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { formatMonthName } from '@/lib/budget-engine'

interface Category {
  id: string
  name: string
  icon: string | null
}

interface Props {
  categories: Category[]
  isOpen: boolean
  onClose: () => void
}

export default function AddAnnualExpenseForm({ categories, isOpen, onClose }: Props) {
  const router = useRouter()
  const currentYear = new Date().getFullYear()

  const [name, setName] = useState('')
  const [annualAmount, setAnnualAmount] = useState('')
  const [dueMonth, setDueMonth] = useState(String(new Date().getMonth() + 1))
  const [dueYear, setDueYear] = useState(String(currentYear))
  const [categoryId, setCategoryId] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!name.trim()) {
      setError('Name is required')
      return
    }
    const amount = parseFloat(annualAmount)
    if (!amount || amount <= 0) {
      setError('Estimated cost must be positive')
      return
    }

    setError('')
    setSubmitting(true)

    try {
      const res = await fetch('/api/budgets/annual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          annualAmount: amount,
          dueMonth: parseInt(dueMonth),
          dueYear: parseInt(dueYear),
          categoryId: categoryId || undefined,
          isRecurring,
          notes: notes.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to create expense')
        return
      }

      // Reset form and close
      setName('')
      setAnnualAmount('')
      setDueMonth(String(new Date().getMonth() + 1))
      setDueYear(String(currentYear))
      setCategoryId('')
      setIsRecurring(false)
      setNotes('')
      onClose()
      router.refresh()
    } catch {
      setError('Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl bg-frost p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-fjord">Add Annual Expense</h3>
        <p className="mt-1 text-sm text-stone">
          Plan a large or irregular expense to save for over time.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="ae-name" className="block text-sm font-medium text-fjord">
              Name
            </label>
            <input
              id="ae-name"
              type="text"
              className="input mt-1 w-full"
              placeholder="e.g. Summer Vacation, Property Tax"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="ae-amount" className="block text-sm font-medium text-fjord">
              Estimated Cost
            </label>
            <input
              id="ae-amount"
              type="number"
              step="0.01"
              min="0.01"
              className="input mt-1 w-full"
              placeholder="2500.00"
              value={annualAmount}
              onChange={(e) => setAnnualAmount(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="ae-month" className="block text-sm font-medium text-fjord">
                Target Month
              </label>
              <select
                id="ae-month"
                className="input mt-1 w-full"
                value={dueMonth}
                onChange={(e) => setDueMonth(e.target.value)}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {formatMonthName(i + 1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ae-year" className="block text-sm font-medium text-fjord">
                Target Year
              </label>
              <select
                id="ae-year"
                className="input mt-1 w-full"
                value={dueYear}
                onChange={(e) => setDueYear(e.target.value)}
              >
                {[currentYear, currentYear + 1, currentYear + 2].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="ae-category" className="block text-sm font-medium text-fjord">
              Category (optional)
            </label>
            <select
              id="ae-category"
              className="input mt-1 w-full"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">No category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="rounded border-mist"
            />
            <span className="text-sm text-fjord">Repeat every year</span>
          </label>

          <div>
            <label htmlFor="ae-notes" className="block text-sm font-medium text-fjord">
              Notes (optional)
            </label>
            <textarea
              id="ae-notes"
              className="input mt-1 w-full"
              rows={2}
              placeholder="Any details about this expense..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-ember">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              type="button"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} loading={submitting} loadingText="Creating...">
              Add Expense
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
