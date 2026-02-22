'use client'

import { formatCurrency } from '@/lib/utils'

interface ProposalItemRowProps {
  name: string
  category: string
  amount: number
  reasoning: string
  extraLabel?: string
  onAmountChange: (amount: number) => void
  onRemove: () => void
}

export default function ProposalItemRow({
  name,
  category,
  amount,
  reasoning,
  extraLabel,
  onAmountChange,
  onRemove,
}: ProposalItemRowProps) {
  return (
    <div className="group flex items-start gap-3 rounded-lg border border-gray-100 bg-white p-3 transition hover:border-gray-200">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{name}</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            {category}
          </span>
          {extraLabel && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
              {extraLabel}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-gray-400">{reasoning}</p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div className="relative">
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">
            $
          </span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => onAmountChange(Math.max(0, parseFloat(e.target.value) || 0))}
            className="input w-24 pl-5 text-right text-sm"
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-gray-300 hover:text-red-500"
          title="Remove"
        >
          &#x2715;
        </button>
      </div>
    </div>
  )
}
