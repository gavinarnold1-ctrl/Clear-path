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

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

export default function AnnualBudgetRow({ name, categoryId, category, annualExpense: ae, spent }: Props) {
  const fundedPct = budgetProgress(ae.funded, ae.annualAmount)
  const spentPct = ae.annualAmount > 0 ? Math.min(Math.round((spent / ae.annualAmount) * 100), 100) : 0
  const monthlyNeeded = calculateMonthlySetAside(ae.annualAmount, ae.funded, ae.dueMonth, ae.dueYear)
  const alert = getAlertLevel(ae.dueMonth, ae.dueYear, ae.funded, ae.annualAmount)

  // Link to category transactions for the current month (matches how spent is computed),
  // falling back to annual expense linked transactions if no category.
  const href = categoryId
    ? `/transactions?categoryId=${categoryId}&month=${getCurrentMonth()}`
    : `/transactions?annualExpenseId=${ae.id}&annualExpenseName=${encodeURIComponent(name)}`

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
          {formatCurrency(spent)} / {formatCurrency(ae.annualAmount)}
        </span>
      </div>

      {/* Spent progress bar */}
      <ProgressBar value={spentPct} />

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
