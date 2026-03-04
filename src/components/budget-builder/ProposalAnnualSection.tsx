'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import type { BudgetProposal } from '@/lib/budget-builder'

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

interface Props {
  items: BudgetProposal['annual']
  onChange: (items: BudgetProposal['annual']) => void
}

export default function ProposalAnnualSection({ items, onChange }: Props) {
  const totalMonthly = items.reduce((sum, i) => sum + i.annualAmount / 12, 0)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [newAmount, setNewAmount] = useState(0)
  const [newDueMonth, setNewDueMonth] = useState(1)

  function updateAmount(index: number, annualAmount: number) {
    const updated = [...items]
    updated[index] = { ...updated[index], annualAmount }
    onChange(updated)
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index))
  }

  function handleAdd() {
    if (!newName.trim() || newAmount <= 0) return
    onChange([
      ...items,
      {
        name: newName.trim(),
        category: newCategory.trim() || newName.trim(),
        annualAmount: newAmount,
        dueMonth: newDueMonth,
        isRecurring: true,
        reasoning: 'Manually added',
      },
    ])
    setNewName('')
    setNewCategory('')
    setNewAmount(0)
    setNewDueMonth(1)
    setAdding(false)
  }

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-fjord">Annual Sinking Funds</h3>
          <p className="text-xs text-stone">Large expenses you save for monthly</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-fjord">{formatCurrency(totalMonthly)}</p>
          <p className="text-xs text-stone">/month set-aside</p>
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item, i) => (
          <div
            key={`${item.name}-${i}`}
            className="group flex items-start gap-3 rounded-lg border border-mist bg-frost p-3 transition hover:border-mist"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-fjord">{item.name}</span>
                <span className="rounded-full bg-mist px-2 py-0.5 text-xs text-stone">
                  {item.category}
                </span>
                <span className="rounded-full bg-lichen/20 px-2 py-0.5 text-xs text-lichen">
                  Due {MONTH_NAMES[item.dueMonth - 1]}
                </span>
                {item.isRecurring && (
                  <span className="rounded-full bg-pine/10 px-2 py-0.5 text-xs text-pine">
                    Recurring
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-stone">{item.reasoning}</p>
              <p className="mt-1 text-xs text-stone">
                {formatCurrency(item.annualAmount / 12)}/mo set-aside
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className="text-right">
                <div className="relative">
                  <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-stone">
                    $
                  </span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={item.annualAmount}
                    onChange={(e) => updateAmount(i, Math.max(0, parseFloat(e.target.value) || 0))}
                    className="input w-24 pl-5 text-right text-sm"
                  />
                </div>
                <p className="mt-0.5 text-right text-xs text-stone">/year</p>
              </div>
              <button
                type="button"
                onClick={() => removeItem(i)}
                className="text-stone hover:text-ember"
                title="Remove"
              >
                &#x2715;
              </button>
            </div>
          </div>
        ))}
      </div>

      {items.length === 0 && !adding && (
        <p className="py-4 text-center text-xs text-stone">No annual expenses proposed</p>
      )}

      {adding ? (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-pine/30 bg-pine/5 p-3">
          <input
            type="text"
            placeholder="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="input flex-1 text-sm"
            autoFocus
          />
          <input
            type="text"
            placeholder="Category"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="input w-32 text-sm"
          />
          <select
            value={newDueMonth}
            onChange={(e) => setNewDueMonth(parseInt(e.target.value))}
            className="input w-20 text-sm"
          >
            {MONTH_NAMES.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <div className="relative">
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-stone">$</span>
            <input
              type="number"
              step="1"
              min="0"
              placeholder="0"
              value={newAmount || ''}
              onChange={(e) => setNewAmount(Math.max(0, parseFloat(e.target.value) || 0))}
              className="input w-24 pl-5 text-right text-sm"
            />
          </div>
          <span className="text-xs text-stone">/yr</span>
          <button type="button" onClick={handleAdd} disabled={!newName.trim() || newAmount <= 0} className="rounded bg-pine px-3 py-1.5 text-xs font-medium text-snow disabled:opacity-40">
            Add
          </button>
          <button type="button" onClick={() => setAdding(false)} className="text-sm text-stone hover:text-ember">
            &#x2715;
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-2 w-full rounded-lg border border-dashed border-mist py-2 text-xs font-medium text-stone hover:border-pine hover:text-pine"
        >
          + Add annual expense
        </button>
      )}
    </section>
  )
}
