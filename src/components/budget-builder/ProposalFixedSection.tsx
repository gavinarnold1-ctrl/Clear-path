'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import ProposalItemRow from './ProposalItemRow'
import type { BudgetProposal } from '@/lib/budget-builder'

interface Props {
  items: BudgetProposal['fixed']
  onChange: (items: BudgetProposal['fixed']) => void
}

export default function ProposalFixedSection({ items, onChange }: Props) {
  const total = items.reduce((sum, i) => sum + i.amount, 0)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [newAmount, setNewAmount] = useState(0)

  function updateAmount(index: number, amount: number) {
    const updated = [...items]
    updated[index] = { ...updated[index], amount }
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
        amount: newAmount,
        dueDay: 1,
        isAutoPay: false,
        confidence: 1,
        reasoning: 'Manually added',
      },
    ])
    setNewName('')
    setNewCategory('')
    setNewAmount(0)
    setAdding(false)
  }

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-fjord">Fixed Bills</h3>
          <p className="text-xs text-stone">Recurring bills with predictable amounts</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-fjord">{formatCurrency(total)}</p>
          <p className="text-xs text-stone">/month</p>
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item, i) => (
          <ProposalItemRow
            key={`${item.name}-${i}`}
            name={item.name}
            category={item.category}
            amount={item.amount}
            reasoning={item.reasoning}
            extraLabel={item.isAutoPay ? 'AutoPay' : undefined}
            onAmountChange={(amt) => updateAmount(i, amt)}
            onRemove={() => removeItem(i)}
          />
        ))}
      </div>

      {items.length === 0 && !adding && (
        <p className="py-4 text-center text-xs text-stone">No fixed bills detected</p>
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
          <div className="relative">
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-stone">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0"
              value={newAmount || ''}
              onChange={(e) => setNewAmount(Math.max(0, parseFloat(e.target.value) || 0))}
              className="input w-24 pl-5 text-right text-sm"
            />
          </div>
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
          + Add fixed bill
        </button>
      )}
    </section>
  )
}
