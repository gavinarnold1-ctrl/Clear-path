import { formatCurrency } from '@/lib/utils'

interface ForecastExpense {
  id: string
  name: string
  annualAmount: number
  computedStatus: string
}

interface Props {
  monthLabel: string
  expenses: ForecastExpense[]
  maxAmount: number
  maxBarHeight: number
  isCurrent: boolean
}

const STATUS_COLORS: Record<string, string> = {
  funded: 'bg-green-400',
  overdue: 'bg-red-400',
  urgent: 'bg-red-300',
  planned: 'bg-purple-400',
  behind: 'bg-amber-400',
}

export default function ForecastBar({
  monthLabel,
  expenses,
  maxAmount,
  maxBarHeight,
  isCurrent,
}: Props) {
  const total = expenses.reduce((s, e) => s + e.annualAmount, 0)
  const barHeight = maxAmount > 0 ? (total / maxAmount) * maxBarHeight : 0

  return (
    <div className="flex flex-col items-center">
      <div className="mb-1 text-[10px] font-medium text-gray-400">{monthLabel}</div>

      {/* Bar container — bottom-aligned */}
      <div
        className="relative flex w-full flex-col-reverse items-stretch"
        style={{ height: `${maxBarHeight}px` }}
      >
        {expenses.length > 0 ? (
          <div className="flex flex-col-reverse" style={{ height: `${barHeight}px` }}>
            {expenses.map((exp) => {
              const segmentPct = total > 0 ? (exp.annualAmount / total) * 100 : 0
              const color = STATUS_COLORS[exp.computedStatus] ?? STATUS_COLORS.planned
              return (
                <div
                  key={exp.id}
                  className={`w-full first:rounded-b last:rounded-t ${color}`}
                  style={{ height: `${segmentPct}%`, minHeight: '4px' }}
                  title={`${exp.name}: ${formatCurrency(exp.annualAmount)}`}
                />
              )
            })}
          </div>
        ) : (
          <div
            className={`w-full rounded ${isCurrent ? 'bg-gray-200' : 'bg-gray-100'}`}
            style={{ height: '4px' }}
          />
        )}
      </div>

      {/* Labels below */}
      {expenses.length > 0 && (
        <div className="mt-1 w-full text-center">
          <div className="text-[10px] font-semibold text-gray-600">
            {formatCurrency(total)}
          </div>
          {expenses.map((exp) => (
            <div key={exp.id} className="truncate text-[9px] text-gray-400">
              {exp.name.split(' ')[0]}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
