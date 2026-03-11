'use client'

import Link from 'next/link'
import ProgressBar from '@/components/ui/ProgressBar'
import { formatCurrency, budgetProgress } from '@/lib/utils'

interface Props {
  id: string
  name: string
  amount: number
  spent: number
  categoryId: string | null
  category: { name: string; icon: string | null } | null
  isCatchAll?: boolean
  overrideCount?: number
  month?: string
}

function getDailyAllowance(amount: number, spent: number): { daily: number; daysLeft: number } {
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const today = now.getDate()
  const daysLeft = daysInMonth - today + 1 // Include today

  const remaining = amount - spent
  const daily = remaining > 0 ? remaining / daysLeft : 0

  return { daily, daysLeft }
}

function getPaceInfo(amount: number, spent: number): { paceMarkerPct: number; diff: number; ahead: boolean } {
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const today = now.getDate()
  const dailyPace = amount / daysInMonth
  const expectedSpend = dailyPace * today
  const paceMarkerPct = amount > 0 ? Math.round((expectedSpend / amount) * 100) : 0
  const diff = expectedSpend - spent
  return { paceMarkerPct, diff, ahead: diff > 0 }
}

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function FlexibleBudgetRow({ id, name, amount, spent, categoryId, category, isCatchAll, overrideCount, month }: Props) {
  const pct = budgetProgress(spent, amount)
  const remaining = amount - spent
  const isOver = spent > amount
  const { daily, daysLeft } = getDailyAllowance(amount, spent)
  const pace = getPaceInfo(amount, spent)
  const effectiveMonth = month ?? getCurrentMonth()

  const pctColor =
    pct >= 100 ? 'text-ember' : pct >= 90 ? 'text-ember' : pct >= 75 ? 'text-birch' : 'text-fjord'

  const href = id
    ? `/transactions?budgetId=${id}&tier=FLEXIBLE&month=${effectiveMonth}&budgetName=${encodeURIComponent(name)}`
    : isCatchAll
      ? `/transactions?tier=FLEXIBLE&catchAll=true&month=${effectiveMonth}`
      : `/transactions?search=${encodeURIComponent(name)}&month=${effectiveMonth}`

  const content = (
    <>
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {category?.icon && <span className="text-sm">{category.icon}</span>}
          <span className="font-medium text-fjord">{name}</span>
          <Link
            href={`/budgets/${id}/edit`}
            onClick={(e) => e.stopPropagation()}
            className="text-stone hover:text-fjord"
            title="Edit budget"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.261-4.262a1.75 1.75 0 0 0 0-2.474Z" />
              <path d="M4.75 3.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h6.5c.69 0 1.25-.56 1.25-1.25V9A.75.75 0 0 1 14 9v2.25A2.75 2.75 0 0 1 11.25 14h-6.5A2.75 2.75 0 0 1 2 11.25v-6.5A2.75 2.75 0 0 1 4.75 2H7a.75.75 0 0 1 0 1.5H4.75Z" />
            </svg>
          </Link>
          {overrideCount != null && overrideCount > 0 && (
            <span className="rounded-badge bg-fjord/10 px-1.5 py-0.5 text-[10px] font-medium text-fjord">
              {overrideCount} manual
            </span>
          )}
        </div>
        <span className="font-mono text-sm text-stone">
          <span className={pctColor}>{formatCurrency(spent)}</span>
          {' / '}
          {formatCurrency(amount)}
        </span>
      </div>

      <ProgressBar value={pct} paceMarker={pace.paceMarkerPct} />

      <div className="mt-1 flex items-center justify-between text-xs">
        {isOver ? (
          <span className="font-semibold text-ember">
            {formatCurrency(Math.abs(remaining))} over budget
          </span>
        ) : (
          <span className="text-stone">
            {formatCurrency(daily)}/day remaining ({daysLeft} day{daysLeft !== 1 ? 's' : ''} left)
            {' · '}
            <span className={pace.ahead ? 'text-pine' : 'text-ember'}>
              {formatCurrency(Math.abs(pace.diff))} {pace.ahead ? 'ahead' : 'behind'}
            </span>
          </span>
        )}
        <span className={`font-semibold ${pctColor}`}>{pct}%</span>
      </div>
    </>
  )

  return (
    <div className="flex items-center gap-2 rounded-lg px-3 py-3 hover:bg-snow">
      <Link href={href} className="block min-w-0 flex-1">{content}</Link>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {categoryId && (
          <Link
            href={`/transactions?categoryId=${categoryId}&month=${effectiveMonth}`}
            className="text-xs text-stone hover:text-fjord"
            title={`View all transactions in ${category?.name ?? name} (across all budgets)`}
          >
            All {category?.name ?? name}
          </Link>
        )}
        {categoryId && (
          <Link
            href={`/spending?category=${encodeURIComponent(category?.name ?? name)}`}
            className="text-xs text-stone hover:text-pine"
          >
            Spending detail →
          </Link>
        )}
      </div>
    </div>
  )
}
