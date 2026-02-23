'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts'
import { formatCurrency } from '@/lib/utils'

interface MonthData {
  label: string
  income: number
  expenses: number
  isCurrent?: boolean
}

interface Props {
  data: MonthData[]
}

export default function MonthlyChart({ data }: Props) {
  if (data.length === 0) return null

  return (
    <div className="card">
      <h2 className="mb-4 text-base font-semibold text-fjord">Income vs Expenses</h2>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={(v: number) => {
                if (v >= 1000) return `$${(v / 1000).toFixed(0)}k`
                return `$${v}`
              }}
            />
            <Tooltip
              formatter={(value: number | undefined, name: string | undefined) => [
                formatCurrency(value ?? 0),
                name ? name.charAt(0).toUpperCase() + name.slice(1) : '',
              ]}
            />
            <Legend />
            <Bar dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={`income-${index}`}
                  fillOpacity={entry.isCurrent ? 1 : 0.6}
                  stroke={entry.isCurrent ? '#16a34a' : 'none'}
                  strokeWidth={entry.isCurrent ? 2 : 0}
                />
              ))}
            </Bar>
            <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={`expenses-${index}`}
                  fillOpacity={entry.isCurrent ? 1 : 0.6}
                  stroke={entry.isCurrent ? '#dc2626' : 'none'}
                  strokeWidth={entry.isCurrent ? 2 : 0}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
