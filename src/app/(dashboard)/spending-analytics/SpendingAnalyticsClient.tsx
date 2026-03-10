'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import { formatCurrency, cn } from '@/lib/utils'
import {
  computeVolatility,
  computeConcentration,
  computeTrend,
  computeComplexity,
} from '@/lib/engines/spending-analytics'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CategoryData {
  categoryId: string
  categoryName: string
  total: number
  transactionCount: number
  avgTransaction: number
}

interface MonthlyData {
  month: string
  categories: CategoryData[]
  totalIncome: number
  totalExpenses: number
  savingsRate: number
}

interface MerchantData {
  merchant: string
  totalSpent: number
  transactionCount: number
  avgTransaction: number
  categoryName: string
  firstSeen: string
  lastSeen: string
  isRecurring: boolean
}

interface RecurringCharge {
  merchant: string
  amount: number
  frequency: 'monthly' | 'quarterly' | 'annual'
  categoryName: string
  lastCharged: string
}

interface BenchmarkData {
  categoryName: string
  userMonthlyAvg: number
  blsMedian: number
  blsP25: number
  blsP75: number
  rating: string
}

interface SummaryData {
  avgMonthlyIncome: number
  avgMonthlyExpenses: number
  avgSavingsRate: number
  totalCategories: number
  totalMerchants: number
  dateRange: { from: string; to: string }
}

interface AnalyticsResponse {
  monthlyBreakdown: MonthlyData[]
  topMerchants: MerchantData[]
  recurringCharges: RecurringCharge[]
  benchmarks: BenchmarkData[]
  summary: SummaryData
}

type TimePeriod = '3m' | '6m' | '12m'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMonth(month: string): string {
  const [year, m] = month.split('-')
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${names[parseInt(m, 10) - 1]} '${year.slice(2)}`
}

function formatPercent(value: number): string {
  return `${Math.round(value * 1000) / 10}%`
}

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

function formatAxisCurrency(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1000) return `$${(abs / 1000).toFixed(1)}k`
  return `$${abs.toFixed(0)}`
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  format,
  subtitle,
}: {
  label: string
  value: number
  format: 'currency' | 'percent'
  subtitle?: string
}) {
  return (
    <div className="rounded-xl border border-mist bg-snow p-4">
      <p className="text-xs font-medium text-stone">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold text-fjord">
        {format === 'currency' ? formatCurrency(Math.abs(value)) : `${Math.round(value * 10) / 10}%`}
      </p>
      {subtitle && <p className="mt-0.5 text-xs text-stone">{subtitle}</p>}
    </div>
  )
}

function RatingBadge({ rating }: { rating: string }) {
  const colors: Record<string, string> = {
    excellent: 'bg-pine/20 text-pine',
    good: 'bg-pine/10 text-pine',
    average: 'bg-birch/30 text-stone',
    high: 'bg-ember/10 text-ember',
    excessive: 'bg-ember/20 text-ember',
  }
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', colors[rating] ?? 'bg-frost text-stone')}>
      {rating}
    </span>
  )
}

function BenchmarkRow({
  category,
  userAmount,
  blsMedian,
  blsP25,
  blsP75,
  rating,
}: {
  category: string
  userAmount: number
  blsMedian: number
  blsP25: number
  blsP75: number
  rating: string
}) {
  const maxVal = Math.max(userAmount, blsP75) * 1.1 || 1
  const userWidth = (userAmount / maxVal) * 100
  const p25Pos = (blsP25 / maxVal) * 100
  const p75Pos = (blsP75 / maxVal) * 100
  const medianPos = (blsMedian / maxVal) * 100

  const ratingColors: Record<string, string> = {
    excellent: 'bg-pine/20 text-pine',
    good: 'bg-pine/10 text-pine',
    average: 'bg-birch/30 text-stone',
    high: 'bg-ember/10 text-ember',
    excessive: 'bg-ember/20 text-ember',
  }

  return (
    <div className="flex items-center gap-4">
      <span className="w-32 flex-shrink-0 text-sm text-fjord">{category}</span>
      <div className="relative h-6 flex-1 rounded bg-frost">
        <div
          className="absolute top-0 h-full rounded bg-birch/15"
          style={{ left: `${p25Pos}%`, width: `${Math.max(p75Pos - p25Pos, 0)}%` }}
        />
        <div
          className="absolute top-0 h-full w-px border-l border-dashed border-birch"
          style={{ left: `${medianPos}%` }}
        />
        <div
          className="absolute top-0.5 h-5 rounded bg-fjord/80"
          style={{ width: `${Math.min(userWidth, 100)}%` }}
        />
      </div>
      <span className="w-20 flex-shrink-0 text-right text-sm font-medium text-fjord">
        {formatCurrency(userAmount)}
      </span>
      <span
        className={cn(
          'w-20 flex-shrink-0 rounded-full px-2 py-0.5 text-center text-xs font-medium',
          ratingColors[rating] ?? 'bg-frost text-stone'
        )}
      >
        {rating}
      </span>
    </div>
  )
}

function ProfileMetric({
  label,
  value,
  subtitle,
  icon,
  color,
}: {
  label: string
  value: string
  subtitle?: string
  icon?: string
  color?: 'pine' | 'ember'
}) {
  return (
    <div>
      <p className="text-xs text-stone">{label}</p>
      <p className={cn('mt-0.5 text-sm font-medium', color === 'ember' ? 'text-ember' : 'text-fjord')}>
        {icon && <span className="mr-1">{icon}</span>}
        {value}
      </p>
      {subtitle && <p className="text-xs text-stone">{subtitle}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Custom tooltip for the trend chart
// ---------------------------------------------------------------------------

function TrendTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-mist bg-snow p-3 text-xs shadow-sm">
      <p className="mb-1 font-medium text-fjord">{label ? formatMonth(label) : ''}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="flex justify-between gap-4" style={{ color: entry.color }}>
          <span>{entry.name}</span>
          <span className="font-medium">{formatCurrency(Math.abs(entry.value))}</span>
        </p>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function SpendingAnalyticsClient() {
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('12m')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const monthCount = timePeriod === '3m' ? 3 : timePeriod === '6m' ? 6 : 12
    fetch(`/api/analytics/spending?months=${monthCount}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load analytics')
        return res.json()
      })
      .then((json: AnalyticsResponse) => {
        setData(json)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [timePeriod])

  // Derived: unique categories across all months
  const allCategories = useMemo(() => {
    if (!data) return []
    const map = new Map<string, string>()
    for (const month of data.monthlyBreakdown) {
      for (const cat of month.categories) {
        if (!map.has(cat.categoryId)) {
          map.set(cat.categoryId, cat.categoryName)
        }
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [data])

  // Auto-select first category
  useEffect(() => {
    if (allCategories.length > 0 && !selectedCategoryId) {
      setSelectedCategoryId(allCategories[0].id)
    }
  }, [allCategories, selectedCategoryId])

  // Category deep-dive data
  const categoryDeepDive = useMemo(() => {
    if (!data || !selectedCategoryId) return null

    const monthlyAmounts: { month: string; total: number }[] = data.monthlyBreakdown.map((m) => {
      const cat = m.categories.find((c) => c.categoryId === selectedCategoryId)
      return { month: m.month, total: cat ? Math.abs(cat.total) : 0 }
    })

    const nonZero = monthlyAmounts.filter((m) => m.total > 0)
    const avgMonthly = nonZero.length > 0 ? nonZero.reduce((s, m) => s + m.total, 0) / nonZero.length : 0

    const highest = monthlyAmounts.reduce((h, m) => (m.total > h.total ? m : h), monthlyAmounts[0])
    const lowest = nonZero.length > 0
      ? nonZero.reduce((l, m) => (m.total < l.total ? m : l), nonZero[0])
      : { month: '-', total: 0 }

    const volatility = computeVolatility(monthlyAmounts.map((m) => m.total))

    const catName = allCategories.find((c) => c.id === selectedCategoryId)?.name ?? ''
    const benchmark = data.benchmarks.find((b) => b.categoryName === catName)

    // Top merchants for this category
    const topMerchants = data.topMerchants
      .filter((m) => m.categoryName === catName)
      .slice(0, 5)

    return {
      name: catName,
      monthlyData: monthlyAmounts,
      avgMonthly,
      highest,
      lowest,
      volatility,
      benchmark,
      topMerchants,
    }
  }, [data, selectedCategoryId, allCategories])

  // Chart data for trends
  const trendChartData = useMemo(() => {
    if (!data) return []
    return data.monthlyBreakdown.map((m) => ({
      month: m.month,
      totalExpenses: Math.abs(m.totalExpenses),
      totalIncome: m.totalIncome,
      savingsAmount: m.totalIncome + m.totalExpenses, // income + (negative expenses)
    }))
  }, [data])

  // Best month by savings rate
  const bestMonth = useMemo(() => {
    if (!data || data.monthlyBreakdown.length === 0) return null
    return data.monthlyBreakdown.reduce((best, m) => (m.savingsRate > best.savingsRate ? m : best))
  }, [data])

  // Recurring totals
  const totalRecurringMonthly = useMemo(() => {
    if (!data) return 0
    return data.recurringCharges.reduce((s, rc) => {
      const monthly =
        rc.frequency === 'monthly'
          ? Math.abs(rc.amount)
          : rc.frequency === 'quarterly'
            ? Math.abs(rc.amount) / 3
            : Math.abs(rc.amount) / 12
      return s + monthly
    }, 0)
  }, [data])

  const totalRecurringAnnual = totalRecurringMonthly * 12

  // Financial profile
  const profileData = useMemo(() => {
    if (!data) return null

    const savingsRates = data.monthlyBreakdown.map((m) => m.savingsRate)
    const savingsRateTrend = computeTrend(savingsRates)

    const categoryTotals = allCategories.map((c) => {
      const total = data.monthlyBreakdown.reduce((s, m) => {
        const cat = m.categories.find((mc) => mc.categoryId === c.id)
        return s + (cat ? cat.total : 0)
      }, 0)
      return { category: c.name, total }
    })
    const concentration = computeConcentration(categoryTotals)

    const recurringRatio =
      data.summary.avgMonthlyExpenses !== 0
        ? totalRecurringMonthly / Math.abs(data.summary.avgMonthlyExpenses)
        : 0

    const belowBenchmark = data.benchmarks.filter(
      (b) => b.rating === 'excellent' || b.rating === 'good'
    ).length
    const atBenchmark = data.benchmarks.filter((b) => b.rating === 'average').length
    const aboveBenchmark = data.benchmarks.filter(
      (b) => b.rating === 'high' || b.rating === 'excessive'
    ).length

    return {
      savingsRateTrend,
      concentration,
      categoryDiversity: data.summary.totalCategories,
      recurringRatio,
      belowBenchmarkCount: belowBenchmark,
      atBenchmarkCount: atBenchmark,
      aboveBenchmarkCount: aboveBenchmark,
    }
  }, [data, allCategories, totalRecurringMonthly])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-fjord">Spending Analytics</h1>
          <p className="mt-1 text-sm text-stone">Loading your financial data...</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-mist bg-frost/50" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-xl border border-mist bg-frost/50" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-semibold text-fjord">Spending Analytics</h1>
        <div className="rounded-xl border border-ember/30 bg-ember/5 p-6 text-center">
          <p className="text-sm text-fjord">{error ?? 'Failed to load analytics data.'}</p>
        </div>
      </div>
    )
  }

  if (data.monthlyBreakdown.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-semibold text-fjord">Spending Analytics</h1>
        <div className="rounded-xl border border-mist bg-snow p-8 text-center">
          <p className="text-sm text-stone">
            Not enough data yet. Add some transactions to see your spending analytics.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-12">
      {/* Header + time period selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-fjord">Spending Analytics</h1>
          <p className="mt-1 text-sm text-stone">Deep analysis of your financial patterns over time</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-frost p-1">
          {(['3m', '6m', '12m'] as const).map((period) => (
            <button
              key={period}
              onClick={() => {
                setTimePeriod(period)
                setSelectedCategoryId(null)
              }}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                timePeriod === period
                  ? 'bg-snow text-fjord shadow-sm'
                  : 'text-stone hover:text-fjord'
              )}
            >
              {period === '3m' ? '3 months' : period === '6m' ? '6 months' : '12 months'}
            </button>
          ))}
        </div>
      </div>

      {/* Financial Profile Summary */}
      {profileData && (
        <div className="rounded-xl border border-mist bg-snow p-6">
          <h2 className="font-display text-lg font-semibold text-fjord">Your Financial Profile</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <ProfileMetric
              label="Savings Rate Trend"
              value={
                profileData.savingsRateTrend > 0.5
                  ? 'Improving'
                  : profileData.savingsRateTrend < -0.5
                    ? 'Declining'
                    : 'Stable'
              }
              icon={
                profileData.savingsRateTrend > 0.5
                  ? '\u2191'
                  : profileData.savingsRateTrend < -0.5
                    ? '\u2193'
                    : '\u2192'
              }
              color={profileData.savingsRateTrend >= 0 ? 'pine' : 'ember'}
            />
            <ProfileMetric
              label="Spending Diversity"
              value={profileData.concentration < 0.15 ? 'Well-diversified' : profileData.concentration < 0.25 ? 'Moderate' : 'Concentrated'}
              subtitle={`${profileData.categoryDiversity} active categories`}
            />
            <ProfileMetric
              label="Recurring Commitment"
              value={formatPercent(profileData.recurringRatio)}
              subtitle="of expenses are recurring"
              color={profileData.recurringRatio > 0.5 ? 'ember' : 'pine'}
            />
            <ProfileMetric
              label="Merchant Diversity"
              value={`${data.summary.totalMerchants} merchants`}
              subtitle="across all categories"
            />
          </div>
          {data.benchmarks.length > 0 && (
            <div className="mt-4 border-t border-mist pt-4">
              <p className="text-xs text-stone">
                vs BLS benchmarks:
                <span className="ml-1 font-medium text-pine">
                  {profileData.belowBenchmarkCount} below median
                </span>
                ,
                <span className="ml-1 font-medium text-stone">
                  {profileData.atBenchmarkCount} at median
                </span>
                ,
                <span className="ml-1 font-medium text-ember">
                  {profileData.aboveBenchmarkCount} above median
                </span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Spending Trends (hero chart) */}
      <section>
        <h2 className="font-display text-xl font-semibold text-fjord">Spending Trends</h2>
        <p className="mt-1 text-sm text-stone">
          {timePeriod === '3m' ? '3-month' : timePeriod === '6m' ? '6-month' : '12-month'} view of
          income vs expenses
        </p>

        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={trendChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--mist)" />
              <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={formatAxisCurrency} tick={{ fontSize: 11 }} />
              <Tooltip content={<TrendTooltip />} />
              <Bar dataKey="totalExpenses" fill="#C4704B" name="Expenses" radius={[4, 4, 0, 0]} />
              <Line
                dataKey="totalIncome"
                stroke="#2D5F3E"
                strokeWidth={2}
                name="Income"
                dot={false}
              />
              <Line
                dataKey="savingsAmount"
                stroke="#1B3A4B"
                strokeWidth={2}
                strokeDasharray="4 4"
                name="Saved"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Avg Monthly Income"
            value={data.summary.avgMonthlyIncome}
            format="currency"
          />
          <StatCard
            label="Avg Monthly Expenses"
            value={data.summary.avgMonthlyExpenses}
            format="currency"
          />
          <StatCard
            label="Avg Savings Rate"
            value={data.summary.avgSavingsRate}
            format="percent"
          />
          {bestMonth && (
            <StatCard
              label="Best Month"
              value={bestMonth.savingsRate}
              format="percent"
              subtitle={formatMonth(bestMonth.month)}
            />
          )}
        </div>
      </section>

      {/* Category Deep Dive */}
      {allCategories.length > 0 && categoryDeepDive && (
        <section>
          <h2 className="font-display text-xl font-semibold text-fjord">Category Deep Dive</h2>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
            {allCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                className={cn(
                  'flex-shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors',
                  selectedCategoryId === cat.id
                    ? 'bg-fjord text-snow'
                    : 'bg-frost text-stone hover:bg-mist'
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            {/* Trend chart */}
            <div className="rounded-xl border border-mist bg-snow p-4">
              <h3 className="text-sm font-medium text-fjord">
                {categoryDeepDive.name} — Monthly Trend
              </h3>
              <div className="mt-2 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryDeepDive.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--mist)" />
                    <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={formatAxisCurrency} tick={{ fontSize: 11 }} />
                    <Bar dataKey="total" fill="#C4704B" radius={[4, 4, 0, 0]} />
                    {categoryDeepDive.benchmark && (
                      <ReferenceLine
                        y={categoryDeepDive.benchmark.blsMedian}
                        stroke="#D4C5A9"
                        strokeDasharray="6 3"
                        label={{ value: 'BLS Median', position: 'right', fontSize: 10, fill: '#8B9A8E' }}
                      />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Stats panel */}
            <div className="rounded-xl border border-mist bg-snow p-4">
              <h3 className="text-sm font-medium text-fjord">Stats</h3>
              <dl className="mt-3 space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-stone">Monthly Average</dt>
                  <dd className="font-medium text-fjord">
                    {formatCurrency(categoryDeepDive.avgMonthly)}
                  </dd>
                </div>
                {categoryDeepDive.benchmark && (
                  <>
                    <div className="flex justify-between">
                      <dt className="text-stone">BLS Median (your bracket)</dt>
                      <dd className="font-medium text-fjord">
                        {formatCurrency(categoryDeepDive.benchmark.blsMedian)}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-stone">Your Rating</dt>
                      <dd>
                        <RatingBadge rating={categoryDeepDive.benchmark.rating} />
                      </dd>
                    </div>
                  </>
                )}
                <div className="flex justify-between">
                  <dt className="text-stone">Highest Month</dt>
                  <dd className="font-medium text-fjord">
                    {formatCurrency(categoryDeepDive.highest.total)} (
                    {formatMonth(categoryDeepDive.highest.month)})
                  </dd>
                </div>
                {categoryDeepDive.lowest.total > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-stone">Lowest Month</dt>
                    <dd className="font-medium text-fjord">
                      {formatCurrency(categoryDeepDive.lowest.total)} (
                      {formatMonth(categoryDeepDive.lowest.month)})
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-stone">Volatility</dt>
                  <dd className="font-medium text-fjord">{categoryDeepDive.volatility.label}</dd>
                </div>
              </dl>

              {categoryDeepDive.topMerchants.length > 0 && (
                <>
                  <h4 className="mt-4 text-xs font-medium text-stone">
                    Top merchants
                  </h4>
                  <ul className="mt-2 space-y-1">
                    {categoryDeepDive.topMerchants.map((m) => (
                      <li key={m.merchant} className="flex justify-between text-sm">
                        <span className="text-fjord">{m.merchant}</span>
                        <span className="text-stone">
                          {formatCurrency(Math.abs(m.totalSpent))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* BLS Benchmark Comparison */}
      {data.benchmarks.length > 0 && (
        <section>
          <h2 className="font-display text-xl font-semibold text-fjord">How You Compare</h2>
          <p className="mt-1 text-sm text-stone">
            Your spending vs national households (BLS 2024 data)
          </p>

          <div className="mt-4 space-y-3">
            {data.benchmarks
              .sort((a, b) => b.userMonthlyAvg - a.userMonthlyAvg)
              .map((b) => (
                <BenchmarkRow
                  key={b.categoryName}
                  category={b.categoryName}
                  userAmount={b.userMonthlyAvg}
                  blsMedian={b.blsMedian}
                  blsP25={b.blsP25}
                  blsP75={b.blsP75}
                  rating={b.rating}
                />
              ))}
          </div>
        </section>
      )}

      {/* Merchant Analysis */}
      {data.topMerchants.length > 0 && (
        <section>
          <h2 className="font-display text-xl font-semibold text-fjord">Where Your Money Goes</h2>
          <p className="mt-1 text-sm text-stone">
            Top merchants over the last{' '}
            {timePeriod === '3m' ? '3 months' : timePeriod === '6m' ? '6 months' : '12 months'}
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mist text-left text-xs font-medium text-stone">
                  <th className="px-3 py-2">Merchant</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Avg</th>
                  <th className="px-3 py-2 text-right">Count</th>
                  <th className="px-3 py-2">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mist">
                {data.topMerchants.map((m) => (
                  <tr key={m.merchant} className="hover:bg-frost/30">
                    <td className="px-3 py-2 font-medium text-fjord">{m.merchant}</td>
                    <td className="px-3 py-2 text-stone">{m.categoryName}</td>
                    <td className="px-3 py-2 text-right text-fjord">
                      {formatCurrency(Math.abs(m.totalSpent))}
                    </td>
                    <td className="px-3 py-2 text-right text-stone">
                      {formatCurrency(Math.abs(m.avgTransaction))}
                    </td>
                    <td className="px-3 py-2 text-right text-stone">{m.transactionCount}</td>
                    <td className="px-3 py-2">
                      {m.isRecurring && (
                        <span className="rounded-full bg-birch/30 px-2 py-0.5 text-xs font-medium text-stone">
                          Recurring
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Recurring Charges Audit */}
      {data.recurringCharges.length > 0 && (
        <section>
          <h2 className="font-display text-xl font-semibold text-fjord">Recurring Charges</h2>
          <p className="mt-1 text-sm text-stone">
            Detected subscriptions and recurring payments — {formatCurrency(totalRecurringMonthly)}
            /month
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.recurringCharges.map((rc) => (
              <div key={rc.merchant} className="rounded-xl border border-mist bg-snow p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-fjord">{rc.merchant}</p>
                    <p className="text-xs text-stone">{rc.categoryName}</p>
                  </div>
                  <p className="text-lg font-semibold text-fjord">
                    {formatCurrency(Math.abs(rc.amount))}
                  </p>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-stone">
                  <span className="rounded bg-frost px-1.5 py-0.5">{rc.frequency}</span>
                  <span>Last charged {formatRelativeDate(rc.lastCharged)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-birch/30 bg-birch/10 p-4">
            <p className="text-sm text-fjord">
              <strong>Annual subscription cost:</strong> {formatCurrency(totalRecurringAnnual)}
            </p>
            {data.summary.avgMonthlyIncome > 0 && (
              <p className="mt-1 text-xs text-stone">
                That&apos;s{' '}
                {formatPercent(totalRecurringAnnual / (data.summary.avgMonthlyIncome * 12))} of your
                annual income going to recurring charges.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
