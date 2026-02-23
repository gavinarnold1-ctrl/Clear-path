'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import { formatMonthName } from '@/lib/budget-engine'

interface AlertExpense {
  id: string
  name: string
  annualAmount: number
  funded: number
  dueMonth: number
  dueYear: number
  status: string
  computedStatus: string
  monthsRemaining: number
}

interface Alert {
  level: 'overdue' | 'urgent' | 'behind' | 'coming' | 'funded'
  message: string
  expenseId: string
}

const ALERT_STYLES = {
  overdue: 'border-red-200 bg-ember/10 text-red-800',
  urgent: 'border-red-200 bg-ember/10 text-red-800',
  behind: 'border-amber-200 bg-amber-50 text-amber-800',
  coming: 'border-blue-200 bg-blue-50 text-blue-800',
  funded: 'border-green-200 bg-pine/10 text-green-800',
}

const ALERT_ICONS = {
  overdue: '\u26A0',
  urgent: '\u26A0',
  behind: '\u2139',
  coming: '\u2139',
  funded: '\u2713',
}

function buildAlerts(expenses: AlertExpense[]): Alert[] {
  const alerts: Alert[] = []

  for (const exp of expenses) {
    if (exp.status === 'spent' || exp.status === 'overspent') continue

    const remaining = exp.annualAmount - exp.funded
    const fundedPct = exp.annualAmount > 0 ? (exp.funded / exp.annualAmount) * 100 : 0

    if (exp.computedStatus === 'overdue' || exp.monthsRemaining <= 0) {
      alerts.push({
        level: 'overdue',
        message: `${exp.name} was due ${formatMonthName(exp.dueMonth)} ${exp.dueYear} — still ${formatCurrency(remaining)} unfunded`,
        expenseId: exp.id,
      })
    } else if (exp.monthsRemaining <= 2 && fundedPct < 50) {
      alerts.push({
        level: 'urgent',
        message: `${exp.name} due in ${exp.monthsRemaining} month${exp.monthsRemaining !== 1 ? 's' : ''} — ${formatCurrency(remaining)} still needed`,
        expenseId: exp.id,
      })
    } else if (exp.funded >= exp.annualAmount) {
      alerts.push({
        level: 'funded',
        message: `${exp.name} is fully funded and ready`,
        expenseId: exp.id,
      })
    } else if (exp.monthsRemaining <= 3 && fundedPct < 70) {
      alerts.push({
        level: 'behind',
        message: `${exp.name} is ${Math.round(fundedPct)}% funded — coming up in ${exp.monthsRemaining} months`,
        expenseId: exp.id,
      })
    } else if (exp.monthsRemaining <= 2) {
      alerts.push({
        level: 'coming',
        message: `${exp.name} coming up in ${exp.monthsRemaining} month${exp.monthsRemaining !== 1 ? 's' : ''} — ${Math.round(fundedPct)}% funded`,
        expenseId: exp.id,
      })
    }
  }

  // Sort by priority: overdue > urgent > behind > coming > funded
  const priority = { overdue: 0, urgent: 1, behind: 2, coming: 3, funded: 4 }
  alerts.sort((a, b) => priority[a.level] - priority[b.level])

  return alerts
}

export default function AnnualAlerts({ expenses }: { expenses: AlertExpense[] }) {
  const [expanded, setExpanded] = useState(false)

  const alerts = buildAlerts(expenses)
  if (alerts.length === 0) return null

  const visible = expanded ? alerts : alerts.slice(0, 3)
  const hasMore = alerts.length > 3

  return (
    <div className="mb-6 space-y-2">
      {visible.map((alert) => (
        <div
          key={alert.expenseId}
          className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm ${ALERT_STYLES[alert.level]}`}
        >
          <span className="shrink-0">{ALERT_ICONS[alert.level]}</span>
          <span>{alert.message}</span>
        </div>
      ))}
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs font-medium text-stone hover:text-fjord"
        >
          {expanded ? 'Show less' : `Show all ${alerts.length} alerts`}
        </button>
      )}
    </div>
  )
}
