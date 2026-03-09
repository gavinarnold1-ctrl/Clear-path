'use client'

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { ForecastPoint, IncomeTransition } from '@/types'

interface Props {
  timeline: ForecastPoint[]
  targetValue: number
  targetDate?: string
  incomeTransitions?: IncomeTransition[]
}

function formatCompact(value: number): string {
  if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

const todayKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

export default function ForecastTimeline({ timeline, targetValue, targetDate, incomeTransitions = [] }: Props) {
  if (timeline.length === 0) {
    return <p className="py-8 text-center text-sm text-stone">No timeline data available.</p>
  }

  return (
    <div>
      <h2 className="mb-4 text-base font-semibold text-fjord">Goal Timeline</h2>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={timeline} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#C8D5CE" opacity={0.5} />
          <XAxis
            dataKey="month"
            tick={{ fill: '#8B9A8E', fontSize: 11 }}
            tickFormatter={(v: string) => {
              const [, m] = v.split('-')
              const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
              return months[parseInt(m, 10) - 1] ?? v
            }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: '#8B9A8E', fontSize: 11 }}
            tickFormatter={formatCompact}
            width={60}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#F7F9F8',
              border: '1px solid #C8D5CE',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={((value: number, name: string) => [
              formatCompact(value ?? 0),
              name === 'conservative'
                ? 'Conservative'
                : name === 'optimistic'
                  ? 'Optimistic'
                  : name === 'projected'
                    ? 'Projected'
                    : name === 'onPlan'
                      ? 'On Plan'
                      : name === 'actual'
                        ? 'Actual'
                        : name,
            ]) as any}
          />

          {/* Uncertainty band */}
          <Area
            type="monotone"
            dataKey="optimistic"
            stroke="none"
            fill="#2D5F3E"
            fillOpacity={0.08}
          />
          <Area
            type="monotone"
            dataKey="conservative"
            stroke="none"
            fill="#F7F9F8"
            fillOpacity={0.8}
          />

          {/* On-plan trajectory (dotted) */}
          <Line
            type="monotone"
            dataKey="onPlan"
            stroke="#D4C5A9"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            dot={false}
          />

          {/* Projected trajectory (dashed) */}
          <Line
            type="monotone"
            dataKey="projected"
            stroke="#2D5F3E"
            strokeDasharray="6 3"
            strokeWidth={2}
            dot={false}
          />

          {/* Actual progress (solid) */}
          <Line
            type="monotone"
            dataKey="actual"
            stroke="#1B3A4B"
            strokeWidth={2.5}
            dot={{ fill: '#1B3A4B', r: 3 }}
            connectNulls={false}
          />

          {/* Target value line */}
          <ReferenceLine
            y={targetValue}
            stroke="#C4704B"
            strokeDasharray="8 4"
            strokeWidth={1}
            label={{
              value: 'Target',
              position: 'right',
              fill: '#C4704B',
              fontSize: 11,
            }}
          />

          {/* Income transition markers */}
          {incomeTransitions.map((t) => {
            const d = new Date(t.date)
            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            return (
              <ReferenceLine
                key={t.id}
                x={monthKey}
                stroke="#D4C5A9"
                strokeDasharray="4 2"
                strokeWidth={1.5}
                label={{
                  value: t.label.length > 15 ? t.label.slice(0, 14) + '…' : t.label,
                  position: 'top',
                  fill: '#8B9A8E',
                  fontSize: 10,
                }}
              />
            )
          })}

          {/* Target date marker */}
          {targetDate && (
            <ReferenceLine
              x={targetDate.slice(0, 7)}
              stroke="#C4704B"
              strokeDasharray="4 2"
              strokeWidth={1.5}
              label={{
                value: 'Target Date',
                position: 'top',
                fill: '#C4704B',
                fontSize: 10,
              }}
            />
          )}

          {/* Today marker */}
          <ReferenceLine
            x={todayKey}
            stroke="#1B3A4B"
            strokeDasharray="2 2"
            strokeWidth={1}
            label={{
              value: 'Today',
              position: 'insideBottomRight',
              fill: '#1B3A4B',
              fontSize: 10,
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-stone">
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 bg-fjord" /> Actual
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-pine" /> Projected
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 border-t-2 border-dotted border-birch" /> On Plan
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-4 rounded bg-pine/10" /> Uncertainty
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-ember" /> Target
        </span>
        {incomeTransitions.length > 0 && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-0 border-l-2 border-dashed border-birch" /> Income Change
          </span>
        )}
        {targetDate && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-0 border-l-2 border-dashed border-ember" /> Target Date
          </span>
        )}
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-0 border-l-2 border-dotted border-fjord" /> Today
        </span>
      </div>
    </div>
  )
}
