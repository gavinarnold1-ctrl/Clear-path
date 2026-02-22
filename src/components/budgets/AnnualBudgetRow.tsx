import ProgressBar from '@/components/ui/ProgressBar'
import { formatCurrency, budgetProgress } from '@/lib/utils'
import { formatMonthName, monthsUntilDue, calculateMonthlySetAside } from '@/lib/budget-engine'

interface AnnualExpense {
  annualAmount: number
  dueMonth: number
  dueYear: number
  monthlySetAside: number
  funded: number
  status: string
  isRecurring: boolean
}

interface Props {
  name: string
  category: { name: string; icon: string | null } | null
  annualExpense: AnnualExpense
}

function getAlertLevel(dueMonth: number, dueYear: number, funded: number, annualAmount: number) {
  const months = monthsUntilDue(dueMonth, dueYear)
  const shortfall = annualAmount - funded

  if (shortfall <= 0) return { level: 'funded' as const, message: 'Ready to go!' }
  if (months <= 0) return { level: 'overdue' as const, message: `Overdue — ${formatCurrency(shortfall)} shortfall` }
  if (months <= 1) return { level: 'urgent' as const, message: `Due next month — ${formatCurrency(shortfall)} still needed` }
  if (months <= 2) return { level: 'warning' as const, message: `Coming up in ${months} months` }
  return { level: 'ok' as const, message: `Due ${formatMonthName(dueMonth)} ${dueYear} (${months} months)` }
}

const ALERT_STYLES = {
  funded: 'text-green-600',
  overdue: 'text-red-600 font-semibold',
  urgent: 'text-red-500',
  warning: 'text-amber-600',
  ok: 'text-gray-500',
}

export default function AnnualBudgetRow({ name, category, annualExpense: ae }: Props) {
  const pct = budgetProgress(ae.funded, ae.annualAmount)
  const monthlyNeeded = calculateMonthlySetAside(ae.annualAmount, ae.funded, ae.dueMonth, ae.dueYear)
  const alert = getAlertLevel(ae.dueMonth, ae.dueYear, ae.funded, ae.annualAmount)

  return (
    <div className="rounded-lg px-3 py-3 hover:bg-gray-50">
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {category?.icon && <span className="text-sm">{category.icon}</span>}
          <span className="font-medium text-gray-900">{name}</span>
          {ae.isRecurring && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
              recurring
            </span>
          )}
        </div>
        <span className="text-sm text-gray-600">
          {formatCurrency(ae.funded)} / {formatCurrency(ae.annualAmount)}
          <span className="ml-2 text-xs text-gray-400">{pct}%</span>
        </span>
      </div>

      <ProgressBar value={pct} />

      <div className="mt-1 flex items-center justify-between text-xs">
        <span className="text-gray-500">
          {formatCurrency(monthlyNeeded)}/mo set-aside
        </span>
        <span className={ALERT_STYLES[alert.level]}>{alert.message}</span>
      </div>
    </div>
  )
}
