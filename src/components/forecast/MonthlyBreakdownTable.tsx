'use client'

import { useState } from 'react'
import type { MonthlyBreakdownRow } from '@/types'

interface Props {
  breakdown: MonthlyBreakdownRow[]
  baselineGoalDate: string | null
  scenarioGoalDate: string | null
  isDebtMetric?: boolean
}

function formatCompactCurrency(amount: number): string {
  const sign = amount >= 0 ? '' : '-'
  const abs = Math.abs(amount)
  if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(1)}M`
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}K`
  return `${sign}$${Math.round(abs).toLocaleString()}`
}

function formatDelta(amount: number): string {
  const prefix = amount > 0 ? '+' : ''
  return `${prefix}${formatCompactCurrency(amount)}`
}

function formatMonth(iso: string): string {
  const [year, month] = iso.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[parseInt(month, 10) - 1]} ${year}`
}

function deltaColor(delta: number, isDebtMetric: boolean): string {
  if (Math.abs(delta) < 0.5) return 'text-stone'
  if (isDebtMetric) {
    return delta < 0 ? 'text-pine' : 'text-ember'
  }
  return delta > 0 ? 'text-pine' : 'text-ember'
}

type ViewMode = 'monthly' | 'quarterly'

export default function MonthlyBreakdownTable({
  breakdown,
  baselineGoalDate,
  scenarioGoalDate,
  isDebtMetric = false,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>(breakdown.length > 60 ? 'quarterly' : 'monthly')

  if (breakdown.length === 0 || breakdown.every(r => Math.abs(r.delta) < 0.01)) {
    return (
      <p className="py-4 text-center text-sm text-stone">
        Run a scenario to see month-by-month projections
      </p>
    )
  }

  // Aggregate to quarterly if needed
  const displayRows = viewMode === 'quarterly'
    ? aggregateQuarterly(breakdown)
    : breakdown

  const defaultVisible = 6
  const visibleRows = expanded ? displayRows : displayRows.slice(0, defaultVisible)
  const hasMore = displayRows.length > defaultVisible

  // Build goal row info
  const goalInfo = buildGoalRowInfo(baselineGoalDate, scenarioGoalDate)

  return (
    <div>
      {/* View mode toggle for long timelines */}
      {breakdown.length > 24 && (
        <div className="mb-2 flex gap-1">
          <button
            onClick={() => setViewMode('monthly')}
            className={`rounded-badge px-2 py-0.5 text-[10px] font-medium transition-colors ${
              viewMode === 'monthly' ? 'bg-fjord text-snow' : 'bg-frost text-stone hover:bg-mist'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setViewMode('quarterly')}
            className={`rounded-badge px-2 py-0.5 text-[10px] font-medium transition-colors ${
              viewMode === 'quarterly' ? 'bg-fjord text-snow' : 'bg-frost text-stone hover:bg-mist'
            }`}
          >
            Quarterly
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-mist bg-snow text-left text-xs uppercase tracking-wide text-stone">
              <th className="min-w-[80px] pb-2 pr-3 pt-1">Month</th>
              <th className="min-w-[80px] pb-2 pr-3 pt-1 text-right">Baseline</th>
              <th className="min-w-[80px] pb-2 pr-3 pt-1 text-right">Scenario</th>
              <th className="min-w-[70px] pb-2 pr-3 pt-1 text-right">&Delta;/mo</th>
              <th className="min-w-[80px] pb-2 pt-1 text-right">Cumulative</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr
                key={row.month}
                className="border-b border-mist/50 hover:bg-frost/30"
              >
                <td className="py-1.5 pr-3 text-sm text-fjord">{formatMonth(row.month)}</td>
                <td className="py-1.5 pr-3 text-right font-mono text-sm text-fjord">
                  {formatCompactCurrency(row.baselineValue)}
                </td>
                <td className="py-1.5 pr-3 text-right font-mono text-sm text-fjord">
                  {formatCompactCurrency(row.scenarioValue)}
                </td>
                <td className={`py-1.5 pr-3 text-right font-mono text-sm ${deltaColor(row.delta, isDebtMetric)}`}>
                  {formatDelta(row.delta)}
                </td>
                <td className={`py-1.5 text-right font-mono text-sm font-medium ${deltaColor(row.cumulativeImpact, isDebtMetric)}`}>
                  {formatDelta(row.cumulativeImpact)}
                </td>
              </tr>
            ))}

            {/* Goal-reached summary row */}
            {goalInfo && (
              <tr className="border-t-2 border-pine/30 bg-pine/10">
                <td colSpan={5} className="py-2 text-center text-xs font-medium text-pine">
                  {goalInfo}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 w-full text-center text-xs font-medium text-stone transition-colors hover:text-fjord"
        >
          {expanded ? 'Show less' : `Show all ${displayRows.length} ${viewMode === 'quarterly' ? 'quarters' : 'months'}`}
        </button>
      )}
    </div>
  )
}

function aggregateQuarterly(rows: MonthlyBreakdownRow[]): MonthlyBreakdownRow[] {
  const quarters: MonthlyBreakdownRow[] = []
  for (let i = 0; i < rows.length; i += 3) {
    const chunk = rows.slice(i, i + 3)
    const last = chunk[chunk.length - 1]
    quarters.push({
      month: chunk[0].month,
      baselineValue: last.baselineValue,
      scenarioValue: last.scenarioValue,
      delta: chunk.reduce((s, r) => s + r.delta, 0),
      cumulativeImpact: last.cumulativeImpact,
    })
  }
  return quarters
}

function buildGoalRowInfo(baselineDate: string | null, scenarioDate: string | null): string | null {
  if (!scenarioDate) return null

  const scenarioLabel = new Date(scenarioDate).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  })

  if (!baselineDate) {
    return `Goal reached: ${scenarioLabel}`
  }

  const baselineLabel = new Date(baselineDate).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  })

  const diff = Math.round(
    (new Date(baselineDate).getTime() - new Date(scenarioDate).getTime()) / (1000 * 60 * 60 * 24 * 30),
  )

  if (diff > 0) {
    return `Goal reached: ${scenarioLabel} (${diff} month${diff !== 1 ? 's' : ''} sooner)`
  } else if (diff < 0) {
    return `Goal reached: ${baselineLabel} → ${scenarioLabel}`
  }
  return `Goal reached: ${scenarioLabel}`
}
