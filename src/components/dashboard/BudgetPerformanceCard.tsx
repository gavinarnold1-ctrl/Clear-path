'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts'
import type { BudgetPerformanceMonth, CategoryPerformanceItem, DashboardGrowthResponse } from '@/types'

type Period = '6mo' | '12mo' | 'all'

function formatCompact(value: number): string {
  if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function BudgetPerformanceCard({ goalMonthlySurplus }: { goalMonthlySurplus?: number | null }) {
  const [period, setPeriod] = useState<Period>('6mo')
  const [data, setData] = useState<DashboardGrowthResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async (p: Period) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/dashboard/growth?period=${p}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(period) }, [period, fetchData])

  if (loading && !data) {
    return (
      <div className="card">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-40 rounded bg-mist" />
          <div className="h-48 rounded bg-mist/50" />
        </div>
      </div>
    )
  }

  if (!data || data.availableMonths < 2) {
    return (
      <div className="card">
        <h2 className="mb-2 text-base font-semibold text-fjord">Budget Performance</h2>
        <p className="text-sm text-stone">
          At least 2 months of data needed to show trends. Keep tracking to unlock this view.
        </p>
      </div>
    )
  }

  const { budgetPerformance: bp } = data

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-fjord">Budget Performance</h2>
        <PeriodPills period={period} setPeriod={setPeriod} availableMonths={data.availableMonths} loading={loading} />
      </div>

      {/* KPI row */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KPI label="Avg Surplus" value={formatCurrency(bp.avgSurplus)} positive={bp.avgSurplus >= 0} />
        <KPI label="Avg Savings Rate" value={`${(bp.avgSavingsRate * 100).toFixed(1)}%`} positive={bp.avgSavingsRate >= 0} />
        <KPI label="Best Month" value={bp.bestMonth ? monthLabel(bp.bestMonth) : '—'} />
        <KPI label="Worst Month" value={bp.worstMonth ? monthLabel(bp.worstMonth) : '—'} />
      </div>

      {/* Diverging bar chart */}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={bp.months} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#C8D5CE" opacity={0.5} />
          <XAxis
            dataKey="month"
            tick={{ fill: '#8B9A8E', fontSize: 11 }}
            tickFormatter={(v: string) => {
              const [, m] = v.split('-')
              return MONTH_LABELS[parseInt(m, 10) - 1] ?? v
            }}
          />
          <YAxis tick={{ fill: '#8B9A8E', fontSize: 11 }} tickFormatter={formatCompact} width={55} />
          <Tooltip
            contentStyle={{ backgroundColor: '#F7F9F8', border: '1px solid #C8D5CE', borderRadius: '8px', fontSize: '12px' }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={((value: number) => [formatCurrency(value ?? 0), value >= 0 ? 'Surplus' : 'Deficit']) as any}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            labelFormatter={((label: string) => monthLabel(label)) as any}
          />
          <ReferenceLine y={0} stroke="#8B9A8E" strokeWidth={1} />
          {goalMonthlySurplus != null && goalMonthlySurplus > 0 && (
            <ReferenceLine
              y={goalMonthlySurplus}
              stroke="#2D5F3E"
              strokeDasharray="6 3"
              strokeWidth={1.5}
              label={{ value: 'Goal', position: 'right', fill: '#2D5F3E', fontSize: 10 }}
            />
          )}
          <Bar dataKey="surplus" radius={[3, 3, 0, 0]}>
            {bp.months.map((m, i) => (
              <Cell key={i} fill={m.surplus >= 0 ? '#2D5F3E' : '#C4704B'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Category breakdown */}
      {bp.categoryBreakdown.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-medium text-fjord">Category Breakdown</h3>
          <div className="space-y-2">
            {bp.categoryBreakdown.slice(0, 8).map((cat) => (
              <CategoryBar key={cat.categoryName} item={cat} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function KPI({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="rounded-lg border border-mist bg-frost/30 px-3 py-2">
      <p className="text-xs font-medium text-stone">{label}</p>
      <p className={`mt-0.5 font-mono text-sm font-medium ${positive === true ? 'text-pine' : positive === false ? 'text-ember' : 'text-fjord'}`}>
        {value}
      </p>
    </div>
  )
}

function CategoryBar({ item }: { item: CategoryPerformanceItem }) {
  const pct = Math.min(item.pctOfBudget, 150)
  const isOver = item.spent > item.budgeted
  const barWidth = Math.min(pct, 100)
  const overflowWidth = pct > 100 ? Math.min(pct - 100, 50) : 0

  return (
    <div className="flex items-center gap-3">
      <div className="w-28 shrink-0">
        <p className="truncate text-xs font-medium text-fjord">{item.categoryName}</p>
      </div>
      <div className="relative flex-1">
        <div className="h-3 overflow-visible rounded-bar bg-mist/50">
          <div
            className={`h-full rounded-bar ${isOver ? 'bg-birch' : 'bg-pine/60'}`}
            style={{ width: `${barWidth}%` }}
          />
          {overflowWidth > 0 && (
            <div
              className="absolute top-0 h-full rounded-r-bar bg-ember/40"
              style={{ left: '100%', width: `${overflowWidth}%` }}
            />
          )}
        </div>
      </div>
      <div className="w-24 shrink-0 text-right">
        <span className="font-mono text-xs text-stone">
          {formatCurrency(item.spent)}
          <span className="text-mist"> / </span>
          {formatCurrency(item.budgeted)}
        </span>
      </div>
      <span className="w-4 shrink-0 text-center text-xs">
        {isOver ? '⚠' : '✓'}
      </span>
    </div>
  )
}

function PeriodPills({
  period,
  setPeriod,
  availableMonths,
  loading,
}: {
  period: Period
  setPeriod: (p: Period) => void
  availableMonths: number
  loading: boolean
}) {
  const pills: { label: string; value: Period; minMonths: number }[] = [
    { label: '6M', value: '6mo', minMonths: 2 },
    { label: '12M', value: '12mo', minMonths: 7 },
    { label: 'All', value: 'all', minMonths: 2 },
  ]

  return (
    <div className="flex gap-1 rounded-button bg-frost p-0.5">
      {pills.map((p) => {
        const disabled = availableMonths < p.minMonths
        return (
          <button
            key={p.value}
            onClick={() => !disabled && setPeriod(p.value)}
            disabled={disabled || loading}
            className={`rounded-badge px-2.5 py-1 text-xs font-medium transition-colors ${
              period === p.value
                ? 'bg-fjord text-snow'
                : disabled
                  ? 'cursor-not-allowed text-stone/40'
                  : 'text-stone hover:text-fjord'
            }`}
          >
            {p.label}
          </button>
        )
      })}
    </div>
  )
}

function monthLabel(month: string): string {
  const [y, m] = month.split('-')
  return `${MONTH_LABELS[parseInt(m, 10) - 1]} ${y}`
}
