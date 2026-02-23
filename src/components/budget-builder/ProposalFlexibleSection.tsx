'use client'

import { formatCurrency } from '@/lib/utils'
import ProposalItemRow from './ProposalItemRow'
import type { BudgetProposal } from '@/lib/budget-builder'

interface Props {
  items: BudgetProposal['flexible']
  onChange: (items: BudgetProposal['flexible']) => void
}

export default function ProposalFlexibleSection({ items, onChange }: Props) {
  const total = items.reduce((sum, i) => sum + i.amount, 0)

  function updateAmount(index: number, amount: number) {
    const updated = [...items]
    updated[index] = { ...updated[index], amount }
    onChange(updated)
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index))
  }

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-fjord">Flexible Spending</h3>
          <p className="text-xs text-stone">Variable spending you control each month</p>
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
            onAmountChange={(amt) => updateAmount(i, amt)}
            onRemove={() => removeItem(i)}
          />
        ))}
      </div>

      {items.length === 0 && (
        <p className="py-4 text-center text-xs text-stone">No variable spending detected</p>
      )}
    </section>
  )
}
