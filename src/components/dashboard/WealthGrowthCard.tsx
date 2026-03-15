'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { WealthGrowthMonth, GrowthBreakdownItem, DashboardGrowthResponse } from '@/types'

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

export default function WealthGrowthCard() {
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
          <div className="h-5 w-36 rounded bg-mist" />
          <div className="h-48 rounded bg-mist/50" />
        </div>
      </div>
    )
  }

  if (!data || data.availableMonths < 2) {
    return (
      <div className="card">
        <h2 className="mb-2 text-base font-semibold text-fjord">Wealth Growth</h2>
        <p className="text-sm text-stone">
          At least 2 months of data needed to show growth trends. Keep tracking to unlock this view.
        </p>
      </div>
    )
  }

  const { wealthGrowth: wg } = data

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-fjord">Wealth Growth</h2>
          <p className={`font-mono text-lg font-medium ${wg.totalGrowth >= 0 ? 'text-pine' : 'text-ember'}`}>
            {wg.totalGrowth >= 0 ? '+' : ''}{formatCurrency(wg.totalGrowth)}
          </p>
        </div>
        <PeriodPills period={period} setPeriod={setPeriod} availableMonths={data.availableMonths} loading={loading} />
      </div>

      {/* Stacked area chart */}
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={wg.months} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
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
            formatter={((value: number, name: string) => [
              formatCurrency(value ?? 0),
              name === 'cash' ? 'Cash Savings' : name === 'investments' ? 'Investments' : name === 'debtReduction' ? 'Debt Paydown' : name,
            ]) as any}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            labelFormatter={((label: string) => {
              const [y, m] = label.split('-')
              return `${MONTH_LABELS[parseInt(m, 10) - 1]} ${y}`
            }) as any}
          />
          <Area
            type="monotone"
            dataKey="debtReduction"
            stackId="1"
            stroke="#D4C5A9"
            fill="#D4C5A9"
            fillOpacity={0.4}
          />
          <Area
            type="monotone"
            dataKey="investments"
            stackId="1"
            stroke="#2D5F3E"
            fill="#2D5F3E"
            fillOpacity={0.3}
          />
          <Area
            type="monotone"
            dataKey="cash"
            stackId="1"
            stroke="#1B3A4B"
            fill="#1B3A4B"
            fillOpacity={0.2}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-stone">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-4 rounded bg-fjord/20" /> Cash Savings
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-4 rounded bg-pine/30" /> Investments
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-4 rounded bg-birch/40" /> Debt Paydown
        </span>
      </div>

      {/* Growth breakdown table */}
      {wg.breakdown.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-medium text-fjord">Growth Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mist text-left text-xs font-medium text-stone">
                  <th className="pb-2 pr-4">Category</th>
                  <th className="pb-2 pr-4 text-right">Current</th>
                  <th className="pb-2 pr-4 text-right">Change</th>
                  <th className="pb-2 text-right">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mist/50">
                {wg.breakdown.map((item) => (
                  <tr key={item.label}>
                    <td className="py-2 pr-4 text-fjord">{item.label}</td>
                    <td className="py-2 pr-4 text-right font-mono text-stone">
                      {formatCurrency(item.currentValue)}
                    </td>
                    <td className={`py-2 pr-4 text-right font-mono text-xs ${item.changeAbs >= 0 ? 'text-pine' : 'text-ember'}`}>
                      {item.changeAbs >= 0 ? '+' : ''}{formatCurrency(item.changeAbs)}
                    </td>
                    <td className={`py-2 text-right font-mono text-xs ${item.changePct >= 0 ? 'text-pine' : 'text-ember'}`}>
                      {item.changePct >= 0 ? '+' : ''}{item.changePct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
