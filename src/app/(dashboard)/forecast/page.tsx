import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getCachedForecast, getForecastAccuracy } from '@/lib/forecast-helpers'
import { formatCurrency } from '@/lib/utils'
import { ASSET_CLASS_DEFAULTS } from '@/lib/engines/forecast'
import { piBreakdown, amortizationSchedule } from '@/lib/engines/amortization'
import { db } from '@/lib/db'
import ForecastInteractive from './ForecastInteractive'
import type { Forecast, IncomeTransition, GoalTarget } from '@/types'

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

export default async function ForecastPage({ searchParams }: { searchParams: Promise<{ focus?: string }> }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const params = await searchParams
  const focusDebt = params.focus === 'debt'

  const [forecast, accuracy, profile] = await Promise.all([
    getCachedForecast(session.userId),
    getForecastAccuracy(session.userId),
    db.userProfile.findUnique({
      where: { userId: session.userId },
      select: { incomeTransitions: true, expectedMonthlyIncome: true, goalTarget: true },
    }),
  ])

  const incomeTransitions: IncomeTransition[] = Array.isArray(profile?.incomeTransitions)
    ? (profile.incomeTransitions as unknown as IncomeTransition[])
    : []

  // Always fetch debts — used for debt payoff timeline and scenario dropdowns
  const debtPayoffData = await db.debt.findMany({
    where: { userId: session.userId },
    orderBy: { interestRate: 'desc' },
    select: {
      id: true, name: true, type: true,
      currentBalance: true, interestRate: true,
      minimumPayment: true, escrowAmount: true,
    },
  })

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
    velocityBreakdown,
    requiredVelocity,
    projectedDate,
    confidence,
    confidenceReason,
    timeline,
    scenarios,
    assetGrowth,
    propertyEquityGrowth,
  } = forecast

  const projectedDateLabel = projectedDate
    ? new Date(projectedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Not projected'

  const goalTarget = profile?.goalTarget as GoalTarget | null
  const isSavingsGoal = goalTarget?.metric === 'savings_amount'

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

      {/* Section 1: Interactive Chart + Scenarios + Summary Cards + Asset Growth */}
      <ForecastInteractive
        timeline={timeline}
        targetValue={goalTarget?.targetValue ?? forecast.projectedValue}
        targetDate={goalTarget?.targetDate}
        incomeTransitions={incomeTransitions}
        scenarios={scenarios}
        baselineProjectedDate={projectedDate ?? null}
        baselineMonthlyVelocity={monthlyVelocity}
        currentValue={currentValue}
        debts={debtPayoffData}
        summaryCards={{
          monthlyVelocity,
          requiredVelocity,
          projectedDateLabel,
          confidence,
          confidenceDetail: velocityBreakdown && velocityBreakdown.monthsOfData < 3
            ? 'Based on your budget plan \u2014 forecast will calibrate as data accumulates'
            : velocityBreakdown && velocityBreakdown.monthsOfData < 6
              ? 'Blending your budget plan with recent spending patterns'
              : velocityBreakdown && velocityBreakdown.monthsOfData >= 6
                ? 'Calibrated from budget plan, recent behavior, and long-term trends'
                : confidenceReason,
          monthsDiff,
        }}
        assetGrowth={assetGrowth}
        assetClassLabels={Object.fromEntries(
          Object.entries(ASSET_CLASS_DEFAULTS).map(([k, v]) => [k, v.label])
        )}
        propertyEquityGrowth={propertyEquityGrowth ?? null}
        isSavingsGoal={isSavingsGoal}
      />

      {/* Debt Payoff Timeline (shown when navigating from debts page) */}
      {focusDebt && debtPayoffData.length > 0 && (() => {
        const interestMap = new Map<string, number>()
        const debtRows = debtPayoffData.map((debt) => {
          const pi = piBreakdown(debt.currentBalance, debt.interestRate, debt.minimumPayment, debt.escrowAmount)
          const payoffDate = pi.monthsRemaining != null
            ? new Date(new Date().getFullYear(), new Date().getMonth() + pi.monthsRemaining, 1)
            : null

          let totalInterest: number | null = null
          if (pi.monthsRemaining != null && pi.monthsRemaining > 0 && pi.piPayment > 0) {
            const schedule = amortizationSchedule({
              principal: Number(debt.currentBalance),
              annualRate: Number(debt.interestRate),
              termMonths: pi.monthsRemaining,
            })
            totalInterest = schedule.totalInterest
          }

          if (totalInterest != null) interestMap.set(debt.id, totalInterest)

          return { debt, pi, payoffDate, totalInterest }
        })

        const totalInterestSum = Array.from(interestMap.values()).reduce((s, v) => s + v, 0)

        return (
          <div className="card mb-6">
            <h2 className="mb-4 text-base font-semibold text-fjord">Debt Payoff Timeline</h2>
            <div className="space-y-3">
              {debtRows.map(({ debt, pi, payoffDate, totalInterest }) => (
                <div key={debt.id} className="flex items-center justify-between rounded-lg border border-mist bg-frost/30 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-fjord">{debt.name}</p>
                    <p className="text-xs text-stone">
                      <span className="font-mono">{formatCurrency(debt.currentBalance)}</span> at <span className="font-mono">{(debt.interestRate * 100).toFixed(1)}%</span>
                    </p>
                  </div>
                  <div className="text-right">
                    {payoffDate ? (
                      <>
                        <p className="text-sm font-medium text-fjord">
                          {payoffDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </p>
                        <p className="text-xs text-stone">
                          {pi.monthsRemaining} months &middot; <span className="font-mono">{formatCurrency(pi.monthlyPrincipal)}</span>/mo principal
                        </p>
                        {totalInterest != null && totalInterest > 0 && (
                          <p className="text-xs text-ember">
                            <span className="font-mono">{formatCurrency(totalInterest)}</span> interest to payoff
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-stone">Payoff date not projected</p>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-mist pt-3">
                <span className="text-sm font-semibold text-fjord">Total Debt</span>
                <span className="font-mono text-sm font-semibold text-fjord">
                  {formatCurrency(debtPayoffData.reduce((s, d) => s + d.currentBalance, 0))}
                </span>
              </div>
              {totalInterestSum > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-stone">Total Interest to Payoff</span>
                  <span className="font-mono text-sm text-ember">
                    {formatCurrency(totalInterestSum)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )
      })()}

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
          <span>Target: {formatCurrency(goalTarget?.targetValue ?? forecast.projectedValue)}</span>
        </div>
      </div>

      {/* Section 3: Forecast Accuracy */}
      {accuracy && accuracy.points.length > 0 && (
        <div className="card mb-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-fjord">Forecast Accuracy</h2>
            <span
              className={`inline-flex items-center rounded-badge px-2 py-0.5 text-xs font-medium ${
                accuracy.rating === 'excellent' || accuracy.rating === 'good'
                  ? 'bg-pine/10 text-pine'
                  : accuracy.rating === 'fair'
                    ? 'bg-birch/20 text-midnight'
                    : 'bg-ember/10 text-ember'
              }`}
            >
              {accuracy.rating.charAt(0).toUpperCase() + accuracy.rating.slice(1)}
            </span>
          </div>
          <p className="mb-4 text-xs text-stone">{accuracy.ratingReason}</p>
          <div className="mb-4 grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs font-medium text-stone">Avg Error</p>
              <p className="mt-0.5 font-mono text-lg font-medium text-fjord">{formatCurrency(accuracy.meanAbsoluteError)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-stone">Avg Error %</p>
              <p className="mt-0.5 font-mono text-lg font-medium text-fjord">{accuracy.meanAbsolutePctError.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-xs font-medium text-stone">Bias</p>
              <p className={`mt-0.5 font-mono text-lg font-medium ${accuracy.bias > 0 ? 'text-pine' : accuracy.bias < 0 ? 'text-ember' : 'text-fjord'}`}>
                {accuracy.bias > 0 ? '+' : ''}{formatCurrency(accuracy.bias)}
              </p>
              <p className="text-[10px] text-stone">{accuracy.bias > 0 ? 'Over-projecting' : accuracy.bias < 0 ? 'Under-projecting' : 'No bias'}</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mist text-left text-xs font-medium text-stone">
                  <th className="pb-2 pr-4">Month</th>
                  <th className="pb-2 pr-4 text-right">Projected</th>
                  <th className="pb-2 pr-4 text-right">Actual</th>
                  <th className="pb-2 text-right">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mist/50">
                {accuracy.points.map((point) => (
                  <tr key={point.month}>
                    <td className="py-2 pr-4 text-fjord">{point.month}</td>
                    <td className="py-2 pr-4 text-right font-mono text-stone">{formatCurrency(point.projected)}</td>
                    <td className="py-2 pr-4 text-right font-mono text-fjord">{formatCurrency(point.actual)}</td>
                    <td className={`py-2 text-right font-mono text-xs ${point.delta >= 0 ? 'text-pine' : 'text-ember'}`}>
                      {point.delta >= 0 ? '+' : ''}{formatCurrency(point.delta)} ({point.deltaPct > 0 ? '+' : ''}{point.deltaPct.toFixed(1)}%)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section 4.5: Income Transitions */}
      {incomeTransitions.length > 0 && (
        <div className="card mb-6">
          <h2 className="mb-4 text-base font-semibold text-fjord">Planned Income Changes</h2>
          <div className="space-y-2">
            {incomeTransitions
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
              .map((t) => {
                const transitionDate = new Date(t.date)
                const isPast = transitionDate <= new Date()
                const incomeDelta = t.monthlyIncome - (profile?.expectedMonthlyIncome ?? 0)
                return (
                  <div key={t.id} className={`flex items-center justify-between rounded-lg border px-4 py-3 ${isPast ? 'border-mist bg-frost/30' : 'border-pine/20 bg-pine/5'}`}>
                    <div>
                      <p className="text-sm font-medium text-fjord">{t.label}</p>
                      <p className="text-xs text-stone">
                        {transitionDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        {isPast && <span className="ml-1 text-stone">(active)</span>}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm font-medium text-fjord">
                        {formatCurrency(t.monthlyIncome)}/mo
                      </p>
                      {incomeDelta !== 0 && (
                        <p className={`text-xs font-medium ${incomeDelta > 0 ? 'text-pine' : 'text-ember'}`}>
                          {incomeDelta > 0 ? '+' : ''}{formatCurrency(incomeDelta)}/mo
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Section 5: Scenarios are now rendered inside ForecastInteractive above */}

      {/* Section 6: Monthly Breakdown Table */}
      <div className="card">
        <h2 className="mb-4 text-base font-semibold text-fjord">Monthly Breakdown</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-mist text-left text-xs font-medium text-stone">
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
