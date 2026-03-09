'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { GOAL_COLORS, CATEGORY_COLORS } from '@/lib/chart-colors'

interface SpendingGroup {
  group: string
  amount: number
  categories: { name: string; amount: number; id?: string }[]
}

interface Props {
  data: SpendingGroup[]
  totalSpent: number
  currentMonth?: string
  budgetByGroup?: Map<string, number>
}

export default function SpendingBreakdown({ data, totalSpent, currentMonth, budgetByGroup }: Props) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)

  // Sort by spend descending for ranked display
  const sorted = [...data].sort((a, b) => b.amount - a.amount)

  const barData = sorted.map((g) => {
    const budget = budgetByGroup?.get(g.group)
    return {
      name: g.group,
      amount: g.amount,
      budget: budget ?? undefined,
    }
  })

  function getBarColor(entry: { name: string; amount: number; budget?: number }): string {
    if (entry.budget != null) {
      return entry.amount > entry.budget ? GOAL_COLORS.threatening : GOAL_COLORS.contributing
    }
    return GOAL_COLORS.neutral
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Bar chart */}
      <div className="card lg:col-span-1">
        <h2 className="mb-4 text-base font-semibold text-fjord">By Group</h2>
        {data.length === 0 ? (
          <p className="text-sm text-stone">No expenses this month.</p>
        ) : (
          <div style={{ height: Math.max(200, barData.length * 40 + 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ left: 4, right: 12, top: 4, bottom: 4 }}>
                <XAxis type="number" tickFormatter={(v: number) => formatCurrency(v)} tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fontSize: 11, fill: '#1B3A4B' }}
                />
                <Tooltip
                  formatter={(value: number | undefined) => formatCurrency(value ?? 0)}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Bar dataKey="amount" radius={[0, 4, 4, 0]} maxBarSize={24}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={getBarColor(entry)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="mt-2 text-center text-sm text-stone">
          Total: <span className="font-semibold text-expense">{formatCurrency(totalSpent)}</span>
        </p>
      </div>

      {/* Category breakdown table */}
      <div className="lg:col-span-2">
        {data.length === 0 ? (
          <div className="card py-12 text-center">
            <p className="text-sm text-stone">No categorised expenses this month.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sorted.map((group, gi) => (
              <div key={group.group} className="card overflow-hidden p-0">
                <button
                  onClick={() => setExpandedGroup(expandedGroup === group.group ? null : group.group)}
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 hover:bg-snow"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: CATEGORY_COLORS[gi % CATEGORY_COLORS.length] }}
                    />
                    <span className="truncate font-semibold text-fjord">{group.group}</span>
                    <span className="shrink-0 whitespace-nowrap text-xs text-stone">
                      {group.categories.length} categor{group.categories.length !== 1 ? 'ies' : 'y'}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="whitespace-nowrap font-semibold text-fjord">{formatCurrency(group.amount)}</span>
                    <span className="whitespace-nowrap text-xs text-stone">
                      {totalSpent > 0 ? `${((group.amount / totalSpent) * 100).toFixed(1)}%` : '—'}
                    </span>
                    <span className="text-stone">{expandedGroup === group.group ? '▲' : '▼'}</span>
                  </div>
                </button>

                {expandedGroup === group.group && (
                  <div className="border-t border-mist">
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-gray-50">
                        {group.categories.map(cat => {
                          const catHref = cat.id && currentMonth
                            ? `/transactions?categoryId=${cat.id}&month=${currentMonth}`
                            : null
                          return (
                            <tr key={cat.id ?? cat.name} className="hover:bg-snow">
                              <td className="px-4 py-2 pl-10 text-fjord">
                                {catHref ? (
                                  <Link href={catHref} className="hover:underline">{cat.name}</Link>
                                ) : (
                                  cat.name
                                )}
                              </td>
                              <td className="px-4 py-2 text-right text-stone">
                                {formatCurrency(cat.amount)}
                              </td>
                              <td className="w-24 px-4 py-2">
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-mist">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${group.amount > 0 ? Math.round((cat.amount / group.amount) * 100) : 0}%`,
                                      backgroundColor: CATEGORY_COLORS[gi % CATEGORY_COLORS.length],
                                    }}
                                  />
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
