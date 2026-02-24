import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { buildTransactionSummary } from '@/lib/insights'
import { formatCurrency } from '@/lib/utils'
import EfficiencyScoreGauge from '@/components/insights/EfficiencyScoreGauge'
import SpendingComparison from '@/components/insights/SpendingComparison'
import InsightsList from '@/components/insights/InsightsList'
import GenerateButton from './GenerateButton'

export const metadata: Metadata = { title: 'Monthly Review' }

export default async function MonthlyReviewPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const [insights, latestScore, transactionCount, snapshots, debts] = await Promise.all([
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
      select: { currentBalance: true, originalBalance: true, name: true, type: true },
    }),
  ])

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

  // Parse person/property breakdowns from latest snapshot (R7.4)
  const personBreakdown: Record<string, number> = latestSnapshot?.personBreakdown
    ? (() => { try { return JSON.parse(latestSnapshot.personBreakdown) } catch { return {} } })()
    : {}
  const propertyBreakdown: Record<string, number> = latestSnapshot?.propertyBreakdown
    ? (() => { try { return JSON.parse(latestSnapshot.propertyBreakdown) } catch { return {} } })()
    : {}

  const hasPersonData = Object.keys(personBreakdown).length > 0
  const hasPropertyData = Object.keys(propertyBreakdown).length > 0

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-fjord">Monthly Review</h1>
        <GenerateButton hasTransactions={transactionCount > 0} />
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

          {/* Debt Progress — R5.5 */}
          {debts.length > 0 && (
            <div className="card">
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
                {debts.map((d, i) => {
                  const paidPct = d.originalBalance
                    ? ((d.originalBalance - d.currentBalance) / d.originalBalance) * 100
                    : 0
                  return (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span className="text-fjord">{d.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-stone">{formatCurrency(d.currentBalance)}</span>
                        {d.originalBalance && paidPct > 0 && (
                          <span className="text-xs text-income">{paidPct.toFixed(0)}% paid</span>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* Per-person breakdown — R7.4 */}
          {hasPersonData && (
            <div className="card">
              <h2 className="mb-4 text-base font-semibold text-fjord">Spending by Person</h2>
              <ul className="space-y-2">
                {Object.entries(personBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([name, amount]) => (
                    <li key={name} className="flex items-center justify-between text-sm">
                      <span className="font-medium text-fjord">{name}</span>
                      <span className="font-mono text-stone">{formatCurrency(amount)}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {/* Per-property breakdown — R7.4 */}
          {hasPropertyData && (
            <div className="card">
              <h2 className="mb-4 text-base font-semibold text-fjord">Spending by Property</h2>
              <ul className="space-y-2">
                {Object.entries(propertyBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([name, amount]) => (
                    <li key={name} className="flex items-center justify-between text-sm">
                      <span className="font-medium text-fjord">{name}</span>
                      <span className="font-mono text-stone">{formatCurrency(amount)}</span>
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
