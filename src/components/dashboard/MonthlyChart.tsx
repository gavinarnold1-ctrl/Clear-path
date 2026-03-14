'use client'

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { CHART_COLORS, GOAL_COLORS } from '@/lib/chart-colors'

interface MonthData {
  label: string
  income: number
  expenses: number
  isCurrent?: boolean
}

interface Props {
  data: MonthData[]
  /** Goal's required monthly surplus (e.g. monthlyNeeded from GoalTarget) */
  goalMonthlySurplus?: number | null
}

export default function MonthlyChart({ data, goalMonthlySurplus }: Props) {
  if (data.length === 0) return null

  // Add surplus as a computed field for the line
  const enriched = data.map((d) => ({
    ...d,
    surplus: Math.round((d.income - d.expenses) * 100) / 100,
  }))

  return (
    <div className="card border-l-4 border-l-fjord">
      <h2 className="mb-4 font-display text-base font-semibold text-fjord">Income vs Expenses</h2>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={enriched} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={(v: number) => {
                if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(0)}k`
                return `$${v}`
              }}
              domain={['auto', 'auto']}
            />
            <Tooltip
              formatter={(value: number | undefined, name: string | undefined) => [
                formatCurrency(value ?? 0),
                name === 'surplus' ? 'Surplus' : name ? name.charAt(0).toUpperCase() + name.slice(1) : '',
              ]}
            />
            <Legend />
            <Bar dataKey="income" fill={CHART_COLORS.income} radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" fill={CHART_COLORS.expense} radius={[4, 4, 0, 0]} />
            <Line
              dataKey="surplus"
              type="monotone"
              stroke={GOAL_COLORS.contributing}
              strokeWidth={2}
              dot={{ r: 3, fill: GOAL_COLORS.contributing }}
              name="surplus"
            />
            {goalMonthlySurplus != null && goalMonthlySurplus > 0 && (
              <ReferenceLine
                y={goalMonthlySurplus}
                stroke={GOAL_COLORS.target}
                strokeDasharray="6 3"
                label={{
                  value: `Goal: ${formatCurrency(goalMonthlySurplus)}/mo`,
                  position: 'insideTopRight',
                  fontSize: 11,
                  fill: GOAL_COLORS.target,
                }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
