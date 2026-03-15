'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface UnbudgetedCategory {
  categoryId: string
  categoryName: string
  spent: number
}

interface Props {
  categories: UnbudgetedCategory[]
}

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

function suggestBudget(spent: number): number {
  // Round up to nearest $25 for a reasonable starting budget
  return Math.ceil(spent / 25) * 25
}

export default function UnbudgetedSection({ categories }: Props) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [bulkSaving, setBulkSaving] = useState(false)

  if (categories.length === 0) return null

  const totalUnbudgeted = categories.reduce((sum, c) => sum + c.spent, 0)

  async function createBudget(categoryId: string, budgetAmount: number) {
    setSaving(true)
    try {
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId,
          amount: budgetAmount,
          period: 'MONTHLY',
          tier: 'FLEXIBLE',
        }),
      })
      if (res.ok) {
        setEditingId(null)
        setAmount('')
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  async function budgetAll() {
    setBulkSaving(true)
    try {
      for (const cat of categories) {
        await fetch('/api/budgets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            categoryId: cat.categoryId,
            amount: suggestBudget(cat.spent),
            period: 'MONTHLY',
            tier: 'FLEXIBLE',
          }),
        })
      }
      router.refresh()
    } finally {
      setBulkSaving(false)
    }
  }

  function startEditing(cat: UnbudgetedCategory) {
    setEditingId(cat.categoryId)
    setAmount(String(suggestBudget(cat.spent)))
  }

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-fjord">Unbudgeted</h2>
          <p className="text-sm text-stone">
            Categories with spending this month but no budget —{' '}
            <span className="font-mono font-medium text-ember">{formatCurrency(totalUnbudgeted)}</span> total
          </p>
        </div>
        {categories.length > 1 && (
          <button
            onClick={budgetAll}
            disabled={bulkSaving}
            className="btn-secondary px-3 py-1.5 text-xs"
          >
            {bulkSaving ? 'Creating...' : `Budget all ${categories.length}`}
          </button>
        )}
      </div>
      <div className="card divide-y divide-mist border-l-4 border-l-stone">
        {categories.map((cat) => (
          <div key={cat.categoryId} className="flex items-center justify-between px-4 py-3">
            <Link
              href={`/transactions?categoryId=${cat.categoryId}&month=${getCurrentMonth()}`}
              className="flex items-center gap-3 hover:text-midnight"
            >
              <span className="font-medium text-fjord">{cat.categoryName}</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href={`/transactions?categoryId=${cat.categoryId}&month=${getCurrentMonth()}`}
                className="text-sm font-semibold text-ember hover:underline"
              >
                <span className="font-mono">{formatCurrency(cat.spent)}</span>
              </Link>
              {editingId === cat.categoryId ? (
                <form
                  className="flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const val = parseFloat(amount)
                    if (val > 0) createBudget(cat.categoryId, val)
                  }}
                >
                  <span className="text-xs text-stone">$</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="input w-20 px-2 py-1 text-xs"
                    min="1"
                    step="1"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-button bg-pine px-2 py-1 text-xs text-snow"
                  >
                    {saving ? '...' : 'Set'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingId(null); setAmount('') }}
                    className="text-xs text-stone hover:text-fjord"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => startEditing(cat)}
                  className="text-xs font-medium text-fjord hover:text-midnight"
                >
                  + Budget
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
