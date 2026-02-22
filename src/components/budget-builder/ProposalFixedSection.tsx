'use client'

import { formatCurrency } from '@/lib/utils'
import ProposalItemRow from './ProposalItemRow'
import type { BudgetProposal } from '@/lib/budget-builder'

interface Props {
  items: BudgetProposal['fixed']
  onChange: (items: BudgetProposal['fixed']) => void
}

export default function ProposalFixedSection({ items, onChange }: Props) {
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
          <h3 className="text-sm font-semibold text-gray-900">Fixed Bills</h3>
          <p className="text-xs text-gray-400">Recurring bills with predictable amounts</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-gray-900">{formatCurrency(total)}</p>
          <p className="text-xs text-gray-400">/month</p>
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

      {items.length === 0 && (
        <p className="py-4 text-center text-xs text-gray-400">No fixed bills detected</p>
      )}
    </section>
  )
}
