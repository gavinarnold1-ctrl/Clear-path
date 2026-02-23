import { formatCurrency } from '@/lib/utils'
import { formatOrdinalDay } from '@/lib/budget-engine'

export type FixedStatus = 'paid' | 'variance' | 'missed' | 'pending'

interface Props {
  name: string
  amount: number
  spent: number
  dueDay: number | null
  isAutoPay: boolean | null
  varianceLimit: number | null
  category: { name: string; icon: string | null } | null
  status: FixedStatus
}

const STATUS_CONFIG: Record<FixedStatus, { icon: string; color: string }> = {
  paid: { icon: '\u2713', color: 'text-pine' },
  variance: { icon: '\u26A0', color: 'text-birch' },
  missed: { icon: '\u2717', color: 'text-ember' },
  pending: { icon: '\u25CB', color: 'text-stone' },
}

export default function FixedBudgetRow({ name, amount, spent, dueDay, isAutoPay, status }: Props) {
  const cfg = STATUS_CONFIG[status]

  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-snow">
      <span className={`text-lg font-bold ${cfg.color}`}>{cfg.icon}</span>
      <div className="min-w-0 flex-1">
        <span className="font-medium text-fjord">{name}</span>
        {dueDay && (
          <span className="ml-2 text-xs text-stone">due {formatOrdinalDay(dueDay)}</span>
        )}
        {isAutoPay && <span className="ml-2 text-xs text-stone">auto-pay</span>}
      </div>
      <div className="text-right">
        {status === 'variance' && spent > 0 ? (
          <span className="text-sm font-semibold text-birch">
            {formatCurrency(spent)}{' '}
            <span className="text-xs text-stone">(was {formatCurrency(amount)})</span>
          </span>
        ) : status === 'missed' ? (
          <span className="text-sm font-semibold text-ember">MISSED</span>
        ) : (
          <span className="text-sm font-semibold text-fjord">{formatCurrency(amount)}</span>
        )}
      </div>
    </div>
  )
}
