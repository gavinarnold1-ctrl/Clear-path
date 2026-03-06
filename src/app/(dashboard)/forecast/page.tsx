import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getCachedForecast } from '@/lib/forecast-helpers'
import { formatCurrency } from '@/lib/utils'
import { ASSET_CLASS_DEFAULTS } from '@/lib/engines/forecast'
import ForecastTimeline from './ForecastTimeline'
import ForecastScenarios from './ForecastScenarios'
import type { Forecast, AssetClass } from '@/types'

export const metadata: Metadata = { title: 'Forecast' }

function PaceIcon({ pace }: { pace: Forecast['pace'] }) {
  const colors: Record<Forecast['pace'], string> = {
    ahead: 'bg-pine/10 text-pine',
    on_track: 'bg-pine/10 text-pine',
    behind: 'bg-birch/20 text-midnight',
    at_risk: 'bg-ember/10 text-ember',
    off_track: 'bg-ember/10 text-ember',
  }
  const labels: Record<Forecast['pace'], string> = {
    ahead: 'Ahead',
    on_track: 'On Track',
    behind: 'Behind',
    at_risk: 'At Risk',
    off_track: 'Off Track',
  }
  return (
    <span className={`inline-flex items-center rounded-badge px-2 py-0.5 text-xs font-medium ${colors[pace]}`}>
      {labels[pace]}
    </span>
  )
}

export default async function ForecastPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const forecast = await getCachedForecast(session.userId)

  if (!forecast) {
    return (
      <div>
        <h1 className="mb-6 font-display text-2xl font-medium text-fjord">Your Forecast</h1>
        <div className="card flex flex-col items-center py-12 text-center">
          <h2 className="mb-2 text-lg font-semibold text-fjord">Set a financial goal to unlock your forecast</h2>
          <p className="mb-6 max-w-md text-sm text-stone">
            A goal gives the forecast a destination. Choose what matters most to you and we&apos;ll
            project your path forward.
          </p>
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-card border border-mist bg-frost/50 px-4 py-3 text-left text-sm">
              <p className="font-medium text-fjord">Save $20,000 by Dec 2027</p>
              <p className="text-xs text-stone">Emergency fund target</p>
            </div>
            <div className="rounded-card border border-mist bg-frost/50 px-4 py-3 text-left text-sm">
              <p className="font-medium text-fjord">Pay off credit cards by June 2027</p>
              <p className="text-xs text-stone">Debt freedom target</p>
            </div>
            <div className="rounded-card border border-mist bg-frost/50 px-4 py-3 text-left text-sm">
              <p className="font-medium text-fjord">Reach $100K net worth</p>
              <p className="text-xs text-stone">Wealth building milestone</p>
            </div>
            <div className="rounded-card border border-mist bg-frost/50 px-4 py-3 text-left text-sm">
              <p className="font-medium text-fjord">Cut dining to $400/mo</p>
              <p className="text-xs text-stone">Spending reduction target</p>
            </div>
          </div>
          <Link href="/settings" className="btn-primary px-6 py-2 text-sm">
            Set your goal
          </Link>
        </div>
      </div>
    )
  }

  const {
    currentValue,
    progressPercent,
    pace,
    paceDetail,
    monthlyVelocity,
    requiredVelocity,
    projectedDate,
    confidence,
    confidenceReason,
    timeline,
    scenarios,
    assetGrowth,
  } = forecast

  const projectedDateLabel = projectedDate
    ? new Date(projectedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Not projected'

  // Calculate months ahead/behind
  const targetDate = new Date(forecast.timeline[0]?.month ? forecast.timeline[forecast.timeline.length - 7]?.month ?? '' : '')
  const monthsDiff = projectedDate && targetDate
    ? Math.round(
        (new Date(targetDate).getTime() - new Date(projectedDate).getTime()) / (1000 * 60 * 60 * 24 * 30),
      )
    : 0

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium text-fjord">Forecast</h1>
        <PaceIcon pace={pace} />
      </div>

      {/* Section 1: Hero Timeline Chart */}
      <div className="card mb-6">
        <ForecastTimeline timeline={timeline} targetValue={forecast.projectedValue} />
      </div>

      {/* Section 2: Pace Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wider text-stone">Avg Monthly Progress</p>
          <p className="mt-1 font-mono text-2xl font-medium text-fjord">
            {formatCurrency(Math.abs(monthlyVelocity))}
          </p>
          <p className="mt-1 text-xs text-stone">/month</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wider text-stone">Needed Monthly</p>
          <p className="mt-1 font-mono text-2xl font-medium text-fjord">
            {formatCurrency(Math.abs(requiredVelocity))}
          </p>
          <p className="mt-1 text-xs text-stone">/month to stay on track</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wider text-stone">Projected Completion</p>
          <p className="mt-1 font-mono text-xl font-medium text-fjord">{projectedDateLabel}</p>
          {monthsDiff !== 0 && (
            <p className={`mt-1 text-xs font-medium ${monthsDiff > 0 ? 'text-pine' : 'text-ember'}`}>
              {Math.abs(monthsDiff)} month{Math.abs(monthsDiff) !== 1 ? 's' : ''}{' '}
              {monthsDiff > 0 ? 'early' : 'late'}
            </p>
          )}
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wider text-stone">Confidence</p>
          <p className="mt-1">
            <span
              className={`inline-flex items-center rounded-badge px-2 py-0.5 text-sm font-medium ${
                confidence === 'high'
                  ? 'bg-pine/10 text-pine'
                  : confidence === 'medium'
                    ? 'bg-birch/20 text-midnight'
                    : 'bg-ember/10 text-ember'
              }`}
            >
              {confidence.charAt(0).toUpperCase() + confidence.slice(1)}
            </span>
          </p>
          <p className="mt-1 text-xs text-stone">{confidenceReason}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="card mb-6">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-fjord">{paceDetail}</span>
          <span className="font-mono text-stone">{progressPercent.toFixed(1)}%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-bar bg-mist">
          <div
            className={`h-full rounded-bar transition-all ${pace === 'ahead' || pace === 'on_track' ? 'bg-pine' : pace === 'behind' ? 'bg-birch' : 'bg-ember'}`}
            style={{ width: `${Math.min(100, progressPercent)}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-stone">
          <span>{formatCurrency(currentValue)}</span>
          <span>Target: {formatCurrency(forecast.projectedValue)}</span>
        </div>
      </div>

      {/* Section 3: Asset Growth Breakdown */}
      {assetGrowth.length > 0 && (
        <div className="card mb-6">
          <h2 className="mb-4 text-base font-semibold text-fjord">Asset Growth Projections (12mo)</h2>
          <div className="space-y-3">
            {assetGrowth.map((ag) => (
              <div key={ag.accountId} className="flex items-center justify-between rounded-lg border border-mist bg-frost/30 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-fjord">{ag.accountName}</p>
                  <p className="text-xs text-stone">
                    {ASSET_CLASS_DEFAULTS[ag.assetClass as AssetClass]?.label ?? ag.assetClass}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-fjord">
                    {formatCurrency(ag.currentBalance)} → {formatCurrency(ag.projectedBalance12mo)}
                  </p>
                  <p className={`text-xs font-medium ${ag.expectedGrowth >= 0 ? 'text-pine' : 'text-ember'}`}>
                    {ag.expectedGrowth >= 0 ? '+' : ''}{formatCurrency(ag.expectedGrowth)}
                  </p>
                  <p className="text-xs text-stone">
                    Range: {formatCurrency(ag.uncertaintyRange.low)} – {formatCurrency(ag.uncertaintyRange.high)}
                  </p>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-mist pt-3">
              <span className="text-sm font-semibold text-fjord">Total Projected Growth</span>
              <span className="font-mono text-sm font-semibold text-pine">
                +{formatCurrency(assetGrowth.reduce((s, a) => s + a.expectedGrowth, 0))}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Section 4: Scenarios */}
      {scenarios.length > 0 && (
        <div className="card mb-6">
          <h2 className="mb-4 text-base font-semibold text-fjord">What-If Scenarios</h2>
          <ForecastScenarios scenarios={scenarios} />
        </div>
      )}

      {/* Section 5: Monthly Breakdown Table */}
      <div className="card">
        <h2 className="mb-4 text-base font-semibold text-fjord">Monthly Breakdown</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-mist text-left text-xs font-medium uppercase tracking-wider text-stone">
                <th className="pb-2 pr-4">Month</th>
                <th className="pb-2 pr-4 text-right">Projected</th>
                <th className="pb-2 pr-4 text-right">On Plan</th>
                <th className="pb-2 pr-4 text-right">Actual</th>
                <th className="pb-2 text-right">Delta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist/50">
              {timeline.slice(0, 24).map((point) => {
                const delta = point.projected - point.onPlan
                const isProjectedCompletion =
                  projectedDate && point.month === projectedDate.slice(0, 7)
                return (
                  <tr
                    key={point.month}
                    className={isProjectedCompletion ? 'bg-pine/5' : ''}
                  >
                    <td className="py-2 pr-4 text-fjord">
                      {point.month}
                      {point.isHistorical && (
                        <span className="ml-1 text-xs text-stone">(past)</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono text-fjord">
                      {formatCurrency(point.projected)}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono text-stone">
                      {formatCurrency(point.onPlan)}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono text-fjord">
                      {point.actual != null ? formatCurrency(point.actual) : '—'}
                    </td>
                    <td
                      className={`py-2 text-right font-mono text-xs ${delta >= 0 ? 'text-pine' : 'text-ember'}`}
                    >
                      {delta >= 0 ? '+' : ''}{formatCurrency(delta)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
