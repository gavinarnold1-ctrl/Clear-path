'use client'

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

  function updateAmount(index: number, annualAmount: number) {
    const updated = [...items]
    updated[index] = { ...updated[index], annualAmount }
    onChange(updated)
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index))
  }

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Annual Sinking Funds</h3>
          <p className="text-xs text-gray-400">Large expenses you save for monthly</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-gray-900">{formatCurrency(totalMonthly)}</p>
          <p className="text-xs text-gray-400">/month set-aside</p>
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item, i) => (
          <div
            key={`${item.name}-${i}`}
            className="group flex items-start gap-3 rounded-lg border border-gray-100 bg-white p-3 transition hover:border-gray-200"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">{item.name}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                  {item.category}
                </span>
                <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-600">
                  Due {MONTH_NAMES[item.dueMonth - 1]}
                </span>
                {item.isRecurring && (
                  <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-600">
                    Recurring
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-gray-400">{item.reasoning}</p>
              <p className="mt-1 text-xs text-gray-500">
                {formatCurrency(item.annualAmount / 12)}/mo set-aside
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className="text-right">
                <div className="relative">
                  <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">
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
                <p className="mt-0.5 text-right text-xs text-gray-400">/year</p>
              </div>
              <button
                type="button"
                onClick={() => removeItem(i)}
                className="text-gray-300 hover:text-red-500"
                title="Remove"
              >
                &#x2715;
              </button>
            </div>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <p className="py-4 text-center text-xs text-gray-400">No annual expenses proposed</p>
      )}
    </section>
  )
}
