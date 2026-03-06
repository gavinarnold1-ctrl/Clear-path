import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { buildTransactionSummary } from '@/lib/insights'
import { formatCurrency } from '@/lib/utils'
import { getValueSummary } from '@/lib/value-tracker'
import EfficiencyScoreGauge from '@/components/insights/EfficiencyScoreGauge'
import SpendingComparison from '@/components/insights/SpendingComparison'
import InsightsList from '@/components/insights/InsightsList'
import GenerateButton from './GenerateButton'
import MonthSelector from './MonthSelector'
import { getGoalContext } from '@/lib/goal-context'
import { projectedDate } from '@/lib/goal-targets'
import type { GoalTarget } from '@/types'

export const metadata: Metadata = { title: 'Monthly Review' }

interface Props {
  searchParams: Promise<{ month?: string }>
}

export default async function MonthlyReviewPage({ searchParams }: Props) {
  const session = await getSession()
  if (!session) redirect('/login')

  const { month: selectedMonth } = await searchParams

  const [insights, latestScore, transactionCount, snapshots, debts, accounts, valueSummary, propertiesForNW, linkedAccountLinks, goalContext, goalProfile] = await Promise.all([
    db.insight.findMany({
      where: { userId: session.userId, status: 'active' },
      orderBy: [{ priority: 'asc' }, { savingsAmount: 'desc' }],
    }),
    db.efficiencyScore.findFirst({
      where: { userId: session.userId },
      orderBy: { createdAt: 'desc' },
    }),
    db.transaction.count({ where: { userId: session.userId } }),
    // Fetch all snapshots for trajectory (R7.2)
    db.monthlySnapshot.findMany({
      where: { userId: session.userId },
      orderBy: { month: 'asc' },
    }),
    // Current debt totals for comparison (R5.5)
    db.debt.findMany({
      where: { userId: session.userId },
      select: { currentBalance: true, originalBalance: true, name: true, type: true, propertyId: true, property: { select: { name: true } } },
    }),
    // Account balances for net worth (R7.9)
    db.account.findMany({
      where: { userId: session.userId },
      select: { id: true, type: true, balance: true },
    }),
    // Cumulative savings identified by AI insights
    getValueSummary(session.userId),
    // Properties for net worth equity calculation
    db.property.findMany({
      where: { userId: session.userId },
      select: { id: true, name: true, currentValue: true, loanBalance: true, type: true },
    }),
    // Account-property links to avoid double-counting mortgage liabilities
    db.accountPropertyLink.findMany({
      where: { account: { userId: session.userId }, property: { currentValue: { not: null } } },
      select: { accountId: true },
    }),
    // Goal context for monthly review goal section
    getGoalContext(session.userId),
    // Goal target from profile
    db.userProfile.findUnique({
      where: { userId: session.userId },
      select: { goalTarget: true, primaryGoal: true },
    }),
  ])

  // R7.8: Convert snapshot months (Date) to YYYY-MM strings
  function formatMonth(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  // R7.8: Available months for selector (from snapshots)
  const availableMonths = snapshots.map((s) => formatMonth(s.month)).reverse()

  // R7.8: If a month is selected, scope to that snapshot
  const activeSnapshot = selectedMonth
    ? snapshots.find((s) => formatMonth(s.month) === selectedMonth) ?? null
    : snapshots[snapshots.length - 1] ?? null

  // Build summary for spending comparison chart
  const summary = transactionCount > 0 ? await buildTransactionSummary(session.userId, 3) : null

  // Parse efficiency score breakdown for summary text
  const scoreBreakdown = latestScore?.breakdown
    ? (() => {
        try {
          return JSON.parse(latestScore.breakdown) as { summary?: string }
        } catch {
          return null
        }
      })()
    : null

  // Calculate total potential savings from active insights
  const totalSavings = insights.reduce((sum, i) => sum + (i.savingsAmount ?? 0), 0)

  // Trajectory data from snapshots (R7.2)
  const hasTrajectory = snapshots.length >= 2
  const firstSnapshot = snapshots[0] ?? null
  const latestSnapshot = snapshots[snapshots.length - 1] ?? null

  // Compute trajectory deltas
  const incomeChange = hasTrajectory
    ? latestSnapshot!.totalIncome - firstSnapshot!.totalIncome
    : null
  const expenseChange = hasTrajectory
    ? latestSnapshot!.totalExpenses - firstSnapshot!.totalExpenses
    : null
  const savingsRateChange = hasTrajectory
    ? latestSnapshot!.savingsRate - firstSnapshot!.savingsRate
    : null

  // Debt trajectory (R5.5)
  const currentTotalDebt = debts.reduce((s, d) => s + d.currentBalance, 0)
  const firstDebt = firstSnapshot?.totalDebt ?? null
  const debtPaidDown = firstDebt !== null ? firstDebt - currentTotalDebt : null

  // Net worth: assets minus liabilities (R7.9), including property equity
  const LIABILITY_TYPES = new Set(['CREDIT_CARD', 'MORTGAGE', 'AUTO_LOAN', 'STUDENT_LOAN'])
  // Accounts linked to properties with values — skip these liabilities to avoid double-counting
  // (property equity = currentValue - loanBalance already accounts for the mortgage)
  const linkedAccountIdSet = new Set(linkedAccountLinks.map(l => l.accountId))
  const accountNetWorth = accounts.reduce((sum, a) => {
    if (linkedAccountIdSet.has(a.id)) return sum // Skip — handled in property equity
    if (LIABILITY_TYPES.has(a.type)) return sum - Math.abs(a.balance)
    return sum + a.balance
  }, 0)
  // Property equity: currentValue minus loanBalance for properties with a value set
  const propertyEquity = propertiesForNW.reduce((sum, p) => {
    if (!p.currentValue) return sum
    return sum + p.currentValue - (p.loanBalance ?? 0)
  }, 0)
  const currentNetWorth = accountNetWorth + propertyEquity
  const hasAccounts = accounts.length > 0 || propertiesForNW.some(p => p.currentValue)

  // Net worth from active snapshot vs previous snapshot for delta
  const activeSnapshotIdx = activeSnapshot
    ? snapshots.findIndex((s) => formatMonth(s.month) === formatMonth(activeSnapshot.month))
    : -1
  const prevSnapshot = activeSnapshotIdx > 0 ? snapshots[activeSnapshotIdx - 1] : null
  const netWorthDelta = activeSnapshot?.netWorth != null && prevSnapshot?.netWorth != null
    ? activeSnapshot.netWorth - prevSnapshot.netWorth
    : null

  // Parse person/property breakdowns from active snapshot (R7.4, R7.8)
  const personBreakdown: Record<string, number> = activeSnapshot?.personBreakdown
    ? (() => { try { return JSON.parse(activeSnapshot.personBreakdown as string) } catch { return {} } })()
    : {}
  const propertyBreakdown: Record<string, number> = activeSnapshot?.propertyBreakdown
    ? (() => { try { return JSON.parse(activeSnapshot.propertyBreakdown as string) } catch { return {} } })()
    : {}

  const hasPersonData = Object.keys(personBreakdown).length > 0
  const hasPropertyData = Object.keys(propertyBreakdown).length > 0

  // R7.8: month param for clickable links
  const monthParam = selectedMonth || activeSnapshot?.month || ''

  // Goal target for monthly review
  const goalTarget = goalProfile?.goalTarget as GoalTarget | null
  // Compute this month's contribution toward goal
  const thisMonthContribution = activeSnapshot
    ? activeSnapshot.totalIncome - activeSnapshot.totalExpenses
    : 0

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-fjord">Monthly Review</h1>
        <div className="flex items-center gap-3">
          {availableMonths.length > 0 && (
            <MonthSelector
              availableMonths={availableMonths}
              selectedMonth={selectedMonth ?? ''}
            />
          )}
          <GenerateButton hasTransactions={transactionCount > 0} />
        </div>
      </div>

      {transactionCount === 0 ? (
        <div className="card text-center">
          <p className="text-lg font-medium text-fjord">No transactions yet</p>
          <p className="mt-2 text-sm text-stone">
            Add some transactions to get AI-powered financial insights and recommendations.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Goal Progress Section — opens the review with goal context */}
          {goalContext && goalTarget && (
            <section>
              <h2 className="mb-4 font-display text-xl text-fjord">Goal Progress</h2>
              <div className="card">
                <p className="text-lg font-semibold text-fjord">{goalTarget.description}</p>

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-sm text-stone">
                    <span>{formatCurrency(goalTarget.currentValue ?? 0)} achieved</span>
                    <span>{formatCurrency(goalTarget.targetValue)} target</span>
                  </div>
                  <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-birch/30">
                    <div
                      className="h-full rounded-full bg-pine transition-all duration-700"
                      style={{ width: `${Math.min(100, Math.round(((goalTarget.currentValue ?? 0) / (goalTarget.targetValue || 1)) * 100))}%` }}
                    />
                  </div>
                </div>

                {/* Month-over-month */}
                <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                  <div>
                    <span className="text-xs text-stone">This month&apos;s contribution</span>
                    <p className="text-lg font-bold text-pine">{formatCurrency(Math.max(0, thisMonthContribution))}</p>
                  </div>
                  <div>
                    <span className="text-xs text-stone">Monthly target</span>
                    <p className="text-lg font-bold text-fjord">{formatCurrency(goalTarget.monthlyNeeded ?? 0)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-stone">Projected completion</span>
                    <p className="text-lg font-bold text-fjord">{projectedDate(goalTarget)}</p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Cumulative value banner */}
          {valueSummary.totalIdentified > 0 && (
            <div className="rounded-xl border border-pine/20 bg-pine/5 px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-stone">Your Oversikt Value</p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="font-mono text-2xl font-semibold text-pine">
                      {formatCurrency(valueSummary.totalIdentified)}
                    </span>
                    <span className="text-sm text-stone">
                      in potential savings identified
                      {valueSummary.since && (
                        <> since {valueSummary.since.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</>
                      )}
                    </span>
                  </div>
                </div>
                {valueSummary.roi > 0 && (
                  <span className="shrink-0 rounded-badge bg-pine/10 px-2.5 py-1 text-sm font-medium text-pine">
                    {valueSummary.roi}x ROI
                  </span>
                )}
              </div>
            </div>
          )}

          {/* R7.8: Month snapshot summary with clickable blocks */}
          {activeSnapshot && (
            <div className="card">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Link
                  href={`/transactions?month=${monthParam}&categoryType=income`}
                  className="group rounded-lg p-2 hover:bg-frost"
                >
                  <p className="text-xs font-medium text-stone">Income</p>
                  <p className="mt-0.5 font-mono text-lg font-semibold text-income group-hover:underline">
                    {formatCurrency(activeSnapshot.totalIncome)}
                  </p>
                </Link>
                <Link
                  href={`/transactions?month=${monthParam}&categoryType=expense`}
                  className="group rounded-lg p-2 hover:bg-frost"
                >
                  <p className="text-xs font-medium text-stone">Expenses</p>
                  <p className="mt-0.5 font-mono text-lg font-semibold text-expense group-hover:underline">
                    {formatCurrency(activeSnapshot.totalExpenses)}
                  </p>
                </Link>
                <Link
                  href={`/spending?month=${monthParam}`}
                  className="group rounded-lg p-2 hover:bg-frost"
                >
                  <p className="text-xs font-medium text-stone">Savings Rate</p>
                  <p className={`mt-0.5 font-mono text-lg font-semibold group-hover:underline ${activeSnapshot.savingsRate >= 0 ? 'text-income' : 'text-expense'}`}>
                    {(activeSnapshot.savingsRate * 100).toFixed(1)}%
                  </p>
                </Link>
                {activeSnapshot.totalDebt != null && activeSnapshot.totalDebt > 0 && (
                  <Link
                    href="/debts"
                    className="group rounded-lg p-2 hover:bg-frost"
                  >
                    <p className="text-xs font-medium text-stone">Debt</p>
                    <p className="mt-0.5 font-mono text-lg font-semibold text-expense group-hover:underline">
                      {formatCurrency(activeSnapshot.totalDebt)}
                    </p>
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Net Worth — R7.9 */}
          {hasAccounts && (
            <div className="card">
              <h2 className="mb-3 text-base font-semibold text-fjord">Net Worth</h2>
              <div className="flex items-baseline gap-4">
                <p className={`font-mono text-2xl font-bold ${currentNetWorth >= 0 ? 'text-fjord' : 'text-expense'}`}>
                  {formatCurrency(currentNetWorth)}
                </p>
                {netWorthDelta !== null && (
                  <p className={`text-sm font-medium ${netWorthDelta >= 0 ? 'text-income' : 'text-expense'}`}>
                    {netWorthDelta >= 0 ? '+' : ''}{formatCurrency(netWorthDelta)} vs prev month
                  </p>
                )}
              </div>
              <p className="mt-1 text-xs text-stone">
                {propertyEquity > 0
                  ? `Accounts: ${formatCurrency(accountNetWorth)} · Property Equity: ${formatCurrency(propertyEquity)}`
                  : 'assets minus liabilities across all accounts'}
              </p>
              {/* Mini trend from snapshots */}
              {snapshots.length >= 2 && (
                <div className="mt-4 flex items-end gap-1">
                  {(() => {
                    const nwValues = snapshots
                      .filter((s) => s.netWorth != null)
                      .map((s) => ({ month: formatMonth(s.month), value: s.netWorth as number }))
                    if (nwValues.length < 2) return null
                    const maxAbs = Math.max(...nwValues.map((v) => Math.abs(v.value)), 1)
                    return (
                      <>
                        {nwValues.map((v, i) => {
                          const height = Math.max(4, Math.round((Math.abs(v.value) / maxAbs) * 48))
                          const isActive = activeSnapshot && v.month === formatMonth(activeSnapshot.month)
                          return (
                            <div key={i} className="flex flex-col items-center gap-1">
                              <div
                                className={`w-6 rounded-sm ${v.value >= 0 ? 'bg-pine/60' : 'bg-ember/60'} ${isActive ? 'ring-2 ring-fjord' : ''}`}
                                style={{ height: `${height}px` }}
                                title={`${v.month}: ${formatCurrency(v.value)}`}
                              />
                              <span className="text-[9px] text-stone">
                                {v.month.split('-')[1]}
                              </span>
                            </div>
                          )
                        })}
                      </>
                    )
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Efficiency score + highlight stat row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {latestScore ? (
              <EfficiencyScoreGauge
                overall={latestScore.overallScore}
                spending={latestScore.spendingScore}
                savings={latestScore.savingsScore}
                debt={latestScore.debtScore}
                summary={scoreBreakdown?.summary}
              />
            ) : (
              <div className="card flex flex-col items-center justify-center gap-2 py-8">
                <p className="text-sm text-stone">No efficiency score yet</p>
                <p className="text-xs text-stone">
                  Generate insights to see your financial efficiency score
                </p>
              </div>
            )}

            {/* Highlight stat */}
            {insights.length > 0 && totalSavings > 0 ? (
              <div className="card flex flex-col justify-center">
                <p className="text-sm font-medium text-stone">Potential Annual Savings</p>
                <p className="mt-1 text-3xl font-bold text-income">
                  {formatCurrency(totalSavings * 12)}
                </p>
                <p className="mt-1 text-xs text-stone">
                  Based on {insights.length} optimization{insights.length !== 1 ? 's' : ''}{' '}
                  identified ({formatCurrency(totalSavings)}/mo)
                </p>
              </div>
            ) : (
              <div className="card flex flex-col justify-center">
                <p className="text-sm font-medium text-stone">Potential Savings</p>
                <p className="mt-2 text-sm text-stone">
                  {insights.length === 0
                    ? 'Generate insights to discover savings opportunities'
                    : 'No estimated savings from current insights'}
                </p>
              </div>
            )}
          </div>

          {/* Since you started — R7.2 trajectory comparison */}
          {hasTrajectory && (
            <div className="card">
              <h2 className="mb-4 text-base font-semibold text-fjord">Since You Started</h2>
              <p className="mb-4 text-xs text-stone">
                Comparing your first recorded month to the most recent ({snapshots.length} month{snapshots.length !== 1 ? 's' : ''} of data)
              </p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {incomeChange !== null && (
                  <div>
                    <p className="text-xs font-medium text-stone">Income</p>
                    <p className={`mt-0.5 font-mono text-lg font-semibold ${incomeChange >= 0 ? 'text-income' : 'text-expense'}`}>
                      {incomeChange >= 0 ? '+' : ''}{formatCurrency(incomeChange)}
                    </p>
                  </div>
                )}
                {expenseChange !== null && (
                  <div>
                    <p className="text-xs font-medium text-stone">Expenses</p>
                    <p className={`mt-0.5 font-mono text-lg font-semibold ${expenseChange <= 0 ? 'text-income' : 'text-expense'}`}>
                      {expenseChange > 0 ? '+' : ''}{formatCurrency(expenseChange)}
                    </p>
                  </div>
                )}
                {savingsRateChange !== null && (
                  <div>
                    <p className="text-xs font-medium text-stone">Savings Rate</p>
                    <p className={`mt-0.5 font-mono text-lg font-semibold ${savingsRateChange >= 0 ? 'text-income' : 'text-expense'}`}>
                      {savingsRateChange >= 0 ? '+' : ''}{(savingsRateChange * 100).toFixed(1)}%
                    </p>
                  </div>
                )}
                {debtPaidDown !== null && debtPaidDown !== 0 && (
                  <div>
                    <p className="text-xs font-medium text-stone">Debt Paid Down</p>
                    <p className={`mt-0.5 font-mono text-lg font-semibold ${debtPaidDown > 0 ? 'text-income' : 'text-expense'}`}>
                      {debtPaidDown > 0 ? '' : '+'}{formatCurrency(Math.abs(debtPaidDown))}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Debt Progress — R5.5 (clickable R7.8) */}
          {debts.length > 0 && (
            <Link href="/debts" className="card block hover:border-fjord/30">
              <h2 className="mb-4 text-base font-semibold text-fjord">Debt Progress</h2>
              <div className="mb-3 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-stone">Current Total Debt</p>
                  <p className="mt-0.5 font-mono text-xl font-semibold text-expense">
                    {formatCurrency(currentTotalDebt)}
                  </p>
                </div>
                {debtPaidDown !== null && debtPaidDown > 0 && (
                  <div>
                    <p className="text-xs font-medium text-stone">Total Paid Down</p>
                    <p className="mt-0.5 font-mono text-xl font-semibold text-income">
                      {formatCurrency(debtPaidDown)}
                    </p>
                  </div>
                )}
              </div>
              <ul className="space-y-2">
                {(() => {
                  const TYPE_LABELS: Record<string, string> = {
                    MORTGAGE: 'Mortgage',
                    STUDENT_LOAN: 'Student Loans',
                    AUTO: 'Auto Loans',
                    CREDIT_CARD: 'Credit Cards',
                    PERSONAL_LOAN: 'Personal Loans',
                    OTHER: 'Other Debt',
                  }
                  // Mortgages: group by property so each property rolls up into one line
                  // Non-mortgages: group by debt type
                  const rows: { key: string; label: string; current: number; original: number }[] = []
                  const mortgagesByProperty = new Map<string, { label: string; current: number; original: number }>()
                  const nonMortgageByType = new Map<string, { current: number; original: number }>()

                  for (const d of debts) {
                    if (d.type === 'MORTGAGE') {
                      const groupKey = d.propertyId ?? `no-prop-${d.name}`
                      const entry = mortgagesByProperty.get(groupKey) ?? {
                        label: d.property?.name ? `${d.property.name} Mortgage` : d.name,
                        current: 0,
                        original: 0,
                      }
                      entry.current += d.currentBalance
                      entry.original += d.originalBalance ?? 0
                      mortgagesByProperty.set(groupKey, entry)
                    } else {
                      const entry = nonMortgageByType.get(d.type) ?? { current: 0, original: 0 }
                      entry.current += d.currentBalance
                      entry.original += d.originalBalance ?? 0
                      nonMortgageByType.set(d.type, entry)
                    }
                  }

                  for (const [key, m] of mortgagesByProperty) {
                    rows.push({ key: `mortgage-${key}`, label: m.label, current: m.current, original: m.original })
                  }
                  for (const [type, totals] of nonMortgageByType) {
                    rows.push({ key: type, label: TYPE_LABELS[type] ?? type, current: totals.current, original: totals.original })
                  }

                  return rows.map((row) => {
                    const paidPct = row.original > 0
                      ? ((row.original - row.current) / row.original) * 100
                      : 0
                    return (
                      <li key={row.key} className="flex items-center justify-between text-sm">
                        <span className="text-fjord">{row.label}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-stone">{formatCurrency(row.current)}</span>
                          {row.original > 0 && paidPct > 0 && (
                            <span className="text-xs text-income">{paidPct.toFixed(0)}% paid</span>
                          )}
                        </div>
                      </li>
                    )
                  })
                })()}
              </ul>
            </Link>
          )}

          {/* Per-person breakdown — R7.4 (clickable R7.8) */}
          {hasPersonData && (
            <div className="card">
              <h2 className="mb-4 text-base font-semibold text-fjord">Spending by Person</h2>
              <ul className="space-y-2">
                {Object.entries(personBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([name, amount]) => (
                    <li key={name}>
                      <Link
                        href={`/spending?month=${monthParam}&view=person`}
                        className="flex items-center justify-between text-sm hover:text-midnight"
                      >
                        <span className="font-medium text-fjord">{name}</span>
                        <span className="font-mono text-stone">{formatCurrency(amount)}</span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {/* Per-property breakdown — R7.4 (clickable R7.8) */}
          {hasPropertyData && (
            <div className="card">
              <h2 className="mb-4 text-base font-semibold text-fjord">Spending by Property</h2>
              <ul className="space-y-2">
                {Object.entries(propertyBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([name, amount]) => (
                    <li key={name}>
                      <Link
                        href={`/spending?month=${monthParam}&view=property`}
                        className="flex items-center justify-between text-sm hover:text-midnight"
                      >
                        <span className="font-medium text-fjord">{name}</span>
                        <span className="font-mono text-stone">{formatCurrency(amount)}</span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {/* Insights list */}
          {insights.length > 0 && (
            <div>
              <h2 className="mb-4 text-base font-semibold text-fjord">Recommendations</h2>
              <InsightsList initialInsights={insights} />
            </div>
          )}

          {/* Spending comparison */}
          {summary && summary.categoryBreakdown.length > 0 && (
            <SpendingComparison
              categories={summary.categoryBreakdown}
              months={summary.period.months}
            />
          )}
        </div>
      )}
    </div>
  )
}
