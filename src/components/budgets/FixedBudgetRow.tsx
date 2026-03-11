import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import { formatOrdinalDay } from '@/lib/budget-engine'

export type FixedStatus = 'paid' | 'variance' | 'missed' | 'pending'

interface Props {
  id: string
  name: string
  amount: number
  spent: number
  dueDay: number | null
  isAutoPay: boolean | null
  varianceLimit: number | null
  categoryId: string | null
  category: { name: string; icon: string | null } | null
  status: FixedStatus
  overrideCount?: number
  month?: string
}

const STATUS_CONFIG: Record<FixedStatus, { icon: string; color: string }> = {
  paid: { icon: '\u2713', color: 'text-pine' },
  variance: { icon: '\u26A0', color: 'text-birch' },
  missed: { icon: '\u2717', color: 'text-ember' },
  pending: { icon: '\u25CB', color: 'text-stone' },
}

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function FixedBudgetRow({ id, name, amount, spent, dueDay, isAutoPay, categoryId, category, status, overrideCount, month }: Props) {
  const cfg = STATUS_CONFIG[status]
  const effectiveMonth = month ?? getCurrentMonth()

  const href = id
    ? `/transactions?budgetId=${id}&tier=FIXED&month=${effectiveMonth}&budgetName=${encodeURIComponent(name)}`
    : null

  const content = (
    <>
      <span className={`text-lg font-bold ${cfg.color}`}>{cfg.icon}</span>
      <div className="min-w-0 flex-1">
        <span className="font-medium text-fjord">{name}</span>
        <Link
          href={`/budgets/${id}/edit`}
          onClick={(e) => e.stopPropagation()}
          className="ml-2 inline-block text-stone hover:text-fjord"
          title="Edit budget"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.261-4.262a1.75 1.75 0 0 0 0-2.474Z" />
            <path d="M4.75 3.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h6.5c.69 0 1.25-.56 1.25-1.25V9A.75.75 0 0 1 14 9v2.25A2.75 2.75 0 0 1 11.25 14h-6.5A2.75 2.75 0 0 1 2 11.25v-6.5A2.75 2.75 0 0 1 4.75 2H7a.75.75 0 0 1 0 1.5H4.75Z" />
          </svg>
        </Link>
        {dueDay && (
          <span className="ml-2 text-xs text-stone">due {formatOrdinalDay(dueDay)}</span>
        )}
        {isAutoPay && <span className="ml-2 text-xs text-stone">auto-pay</span>}
        {overrideCount != null && overrideCount > 0 && (
          <span className="ml-2 rounded-badge bg-fjord/10 px-1.5 py-0.5 text-[10px] font-medium text-fjord">
            {overrideCount} manual
          </span>
        )}
      </div>
      <div className="text-right">
        {status === 'variance' && spent > 0 ? (
          <span className="font-mono text-sm font-semibold text-birch">
            {formatCurrency(spent)}{' '}
            <span className="text-xs text-stone">(was {formatCurrency(amount)})</span>
          </span>
        ) : status === 'missed' ? (
          <span className="text-sm font-semibold text-ember">MISSED</span>
        ) : (
          <span className="font-mono text-sm font-semibold text-fjord">{formatCurrency(amount)}</span>
        )}
      </div>
    </>
  )

  const className = "flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-snow"

  return (
    <div className="flex items-center gap-2">
      {href ? (
        <Link href={href} className={`min-w-0 flex-1 ${className}`}>{content}</Link>
      ) : (
        <div className={`min-w-0 flex-1 ${className}`}>{content}</div>
      )}
      {categoryId && (
        <Link
          href={`/transactions?categoryId=${categoryId}&month=${effectiveMonth}`}
          className="shrink-0 text-xs text-stone hover:text-fjord"
          title={`View all transactions in this category (across all budgets)`}
        >
          All {category?.name ?? name}
        </Link>
      )}
    </div>
  )
}
