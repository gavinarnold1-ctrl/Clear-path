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
    <div className="group flex items-start gap-3 rounded-lg border border-mist bg-frost p-3 transition hover:border-mist">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-fjord">{name}</span>
          <span className="rounded-full bg-mist px-2 py-0.5 text-xs text-stone">
            {category}
          </span>
          {extraLabel && (
            <span className="rounded-full bg-frost px-2 py-0.5 text-xs text-fjord">
              {extraLabel}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-stone">{reasoning}</p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div className="relative">
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-stone">
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
          className="text-stone hover:text-ember"
          title="Remove"
        >
          &#x2715;
        </button>
      </div>
    </div>
  )
}
