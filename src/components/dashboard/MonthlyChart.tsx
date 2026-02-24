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
            <Bar dataKey="income" fill="#52B788" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={`income-${index}`}
                  fillOpacity={entry.isCurrent ? 1 : 0.6}
                  stroke={entry.isCurrent ? '#2D5F3E' : 'none'}
                  strokeWidth={entry.isCurrent ? 2 : 0}
                />
              ))}
            </Bar>
            <Bar dataKey="expenses" fill="#C4704B" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={`expenses-${index}`}
                  fillOpacity={entry.isCurrent ? 1 : 0.6}
                  stroke={entry.isCurrent ? '#a35a3a' : 'none'}
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
