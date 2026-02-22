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

export const metadata: Metadata = { title: 'Financial Insights' }

export default async function InsightsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const [insights, latestScore, transactionCount] = await Promise.all([
    db.insight.findMany({
      where: { userId: session.userId, status: 'active' },
      orderBy: [{ priority: 'asc' }, { savingsAmount: 'desc' }],
    }),
    db.efficiencyScore.findFirst({
      where: { userId: session.userId },
      orderBy: { createdAt: 'desc' },
    }),
    db.transaction.count({ where: { userId: session.userId } }),
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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Financial Insights</h1>
        <GenerateButton hasTransactions={transactionCount > 0} />
      </div>

      {transactionCount === 0 ? (
        <div className="card text-center">
          <p className="text-lg font-medium text-gray-700">No transactions yet</p>
          <p className="mt-2 text-sm text-gray-400">
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
                <p className="text-sm text-gray-400">No efficiency score yet</p>
                <p className="text-xs text-gray-400">
                  Generate insights to see your financial efficiency score
                </p>
              </div>
            )}

            {/* Highlight stat */}
            {insights.length > 0 && totalSavings > 0 ? (
              <div className="card flex flex-col justify-center">
                <p className="text-sm font-medium text-gray-500">Potential Annual Savings</p>
                <p className="mt-1 text-3xl font-bold text-income">
                  {formatCurrency(totalSavings * 12)}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Based on {insights.length} optimization{insights.length !== 1 ? 's' : ''}{' '}
                  identified ({formatCurrency(totalSavings)}/mo)
                </p>
              </div>
            ) : (
              <div className="card flex flex-col justify-center">
                <p className="text-sm font-medium text-gray-500">Potential Savings</p>
                <p className="mt-2 text-sm text-gray-400">
                  {insights.length === 0
                    ? 'Generate insights to discover savings opportunities'
                    : 'No estimated savings from current insights'}
                </p>
              </div>
            )}
          </div>

          {/* Insights list */}
          {insights.length > 0 && (
            <div>
              <h2 className="mb-4 text-base font-semibold text-gray-900">Recommendations</h2>
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
