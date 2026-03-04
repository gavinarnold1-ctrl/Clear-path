import Link from 'next/link'
import ProgressBar from '@/components/ui/ProgressBar'
import { formatCurrency, budgetProgress } from '@/lib/utils'
import { formatMonthName, monthsUntilDue, calculateMonthlySetAside } from '@/lib/budget-engine'

interface AnnualExpense {
  id: string
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
  categoryId: string | null
  category: { name: string; icon: string | null } | null
  annualExpense: AnnualExpense
  spent: number
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
  funded: 'text-pine',
  overdue: 'text-ember font-semibold',
  urgent: 'text-ember',
  warning: 'text-birch',
  ok: 'text-stone',
}

export default function AnnualBudgetRow({ name, categoryId, category, annualExpense: ae, spent }: Props) {
  const fundedPct = budgetProgress(ae.funded, ae.annualAmount)
  const spentPct = ae.annualAmount > 0 ? Math.min(Math.round((spent / ae.annualAmount) * 100), 100) : 0
  const monthlyNeeded = calculateMonthlySetAside(ae.annualAmount, ae.funded, ae.dueMonth, ae.dueYear)
  const alert = getAlertLevel(ae.dueMonth, ae.dueYear, ae.funded, ae.annualAmount)
  const overspent = spent > ae.funded

  const href = `/transactions?annualExpenseId=${ae.id}&annualExpenseName=${encodeURIComponent(name)}`

  const content = (
    <>
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {category?.icon && <span className="text-sm">{category.icon}</span>}
          <span className="font-medium text-fjord">{name}</span>
          {ae.isRecurring && (
            <span className="rounded bg-mist px-1.5 py-0.5 text-[10px] font-medium text-stone">
              recurring
            </span>
          )}
          <span className={`rounded-badge px-1.5 py-0.5 text-[10px] font-semibold ${
            fundedPct >= 100 ? 'bg-pine/10 text-pine' : 'bg-mist text-stone'
          }`}>
            {fundedPct}% funded
          </span>
        </div>
        <span className="text-sm text-stone">
          {formatCurrency(ae.funded)} / {formatCurrency(ae.annualAmount)}
        </span>
      </div>

      {/* Funded progress bar */}
      <ProgressBar value={fundedPct} />

      {/* Spent bar — shown when there's spending against this annual plan */}
      {spent > 0 && (
        <div className="mt-1">
          <div className="relative h-1.5 w-full overflow-hidden rounded-bar bg-mist">
            <div
              className={`h-full rounded-bar transition-all duration-300 ${overspent ? 'bg-ember' : 'bg-birch'}`}
              style={{ width: `${spentPct}%` }}
            />
          </div>
          <div className="mt-0.5 flex items-center justify-between text-[11px]">
            <span className={overspent ? 'font-medium text-ember' : 'text-stone'}>
              {formatCurrency(spent)} spent
            </span>
            {overspent && (
              <span className="text-ember">
                {formatCurrency(spent - ae.funded)} over funded
              </span>
            )}
          </div>
        </div>
      )}

      <div className="mt-1 flex items-center justify-between text-xs">
        <span className="text-stone">
          {formatCurrency(monthlyNeeded)}/mo set-aside
        </span>
        <span className={ALERT_STYLES[alert.level]}>{alert.message}</span>
      </div>
    </>
  )

  return (
    <Link href={href} className="block rounded-lg px-3 py-3 hover:bg-snow">{content}</Link>
  )
}
