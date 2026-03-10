'use client'

import { useState, useCallback, useMemo } from 'react'
import ForecastTimeline from './ForecastTimelineLazy'
import ForecastScenarios from './ForecastScenarios'
import type { ForecastPoint, ForecastScenario, IncomeTransition, VelocityBreakdown } from '@/types'
import type { Forecast } from '@/types'

interface CombinedScenarioMetrics {
  monthlyDelta: number
  totalImpact: number
  projectedDate: string | null
  monthsShift: number
  activeCount: number
}

interface DebtSummary {
  id: string
  name: string
  type: string
  currentBalance: number
  interestRate: number
  minimumPayment: number
  escrowAmount: number | null
}

interface SummaryCardData {
  monthlyVelocity: number
  requiredVelocity: number
  projectedDate: string | null
  projectedDateLabel: string
  monthsDiff: number
  confidence: 'high' | 'medium' | 'low'
  confidenceReason: string
  velocityBreakdown: VelocityBreakdown | null
  pace: Forecast['pace']
  paceDetail: string
  progressPercent: number
  currentValue: number
}

// Per-account growth assumption
interface AccountGrowthOverride {
  accountId: string
  rate: number
}

// Growth assumption profiles
const GROWTH_PROFILES = [
  { id: 'current', label: 'Current', description: 'Per-account-type defaults' },
  { id: 'conservative', label: 'Conservative', description: 'Lower risk, stable returns' },
  { id: 'moderate', label: 'Moderate', description: 'Balanced risk and return' },
  { id: 'aggressive', label: 'Aggressive', description: 'Higher potential return' },
] as const

const GROWTH_DEFAULTS_BY_TYPE: Record<string, number> = {
  CHECKING: 0,
  SAVINGS: 4.5,
  INVESTMENT: 8.0,
  CASH: 0,
}

const GROWTH_PROFILES_BY_TYPE: Record<string, Record<string, number>> = {
  conservative: { CHECKING: 0, SAVINGS: 4.0, INVESTMENT: 5.0, CASH: 0 },
  moderate: { CHECKING: 0, SAVINGS: 4.5, INVESTMENT: 8.0, CASH: 0 },
  aggressive: { CHECKING: 0, SAVINGS: 4.5, INVESTMENT: 10.0, CASH: 0 },
}

interface Props {
  timeline: ForecastPoint[]
  targetValue: number
  targetDate?: string
  incomeTransitions: IncomeTransition[]
  scenarios: ForecastScenario[]
  baselineProjectedDate: string | null
  baselineMonthlyVelocity: number
  currentValue: number
  debts?: DebtSummary[]
  summaryCards?: SummaryCardData
  assetGrowth?: AssetGrowthItem[]
}

interface AssetGrowthItem {
  accountId: string
  accountName: string
  assetClass: string
  currentBalance: number
  projectedBalance12mo: number
  expectedGrowth: number
  uncertaintyRange: { low: number; high: number }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function ForecastInteractive({
  timeline,
  targetValue,
  targetDate,
  incomeTransitions,
  scenarios,
  baselineProjectedDate,
  baselineMonthlyVelocity,
  currentValue,
  debts = [],
  summaryCards,
  assetGrowth,
}: Props) {
  const [activeScenarioIds, setActiveScenarioIds] = useState<string[]>([])
  const [growthProfile, setGrowthProfile] = useState<string>('current')
  const [_accountOverrides, _setAccountOverrides] = useState<AccountGrowthOverride[]>([])

  // All scenarios including custom ones added by ForecastScenarios
  const [customScenarios, setCustomScenarios] = useState<ForecastScenario[]>([])
  const allScenarios = useMemo(() => [...scenarios, ...customScenarios], [scenarios, customScenarios])

  const handleScenarioToggle = useCallback((scenarioId: string) => {
    setActiveScenarioIds(prev => {
      if (prev.includes(scenarioId)) {
        return prev.filter(id => id !== scenarioId)
      }
      if (prev.length >= 4) return prev // Cap at 4
      return [...prev, scenarioId]
    })
  }, [])

  const handleClearAll = useCallback(() => {
    setActiveScenarioIds([])
  }, [])

  const handleCustomScenarioAdd = useCallback((scenario: ForecastScenario) => {
    setCustomScenarios(prev => [...prev, scenario])
  }, [])

  const handleCustomScenarioRemove = useCallback((id: string) => {
    setCustomScenarios(prev => prev.filter(s => s.id !== id))
    setActiveScenarioIds(prev => prev.filter(sid => sid !== id))
  }, [])

  // Compute combined timeline from active scenarios using delta stacking (Approach A)
  const { combinedTimeline, combinedMetrics } = useMemo(() => {
    const activeScenarios = allScenarios.filter(s => activeScenarioIds.includes(s.id))
    if (activeScenarios.length === 0) {
      return { combinedTimeline: null, combinedMetrics: null }
    }

    // Sum monthly deltas from all active scenarios
    const combinedMonthlyDelta = activeScenarios.reduce(
      (sum, s) => sum + (s.impact.monthlyImpactOnTrueRemaining ?? 0), 0
    )

    // Sum total impact from breakdown data
    const totalImpact = activeScenarios.reduce((sum, s) => {
      const lastRow = s.monthlyBreakdown?.[s.monthlyBreakdown.length - 1]
      return sum + (lastRow?.cumulativeImpact ?? 0)
    }, 0)

    // Build combined timeline by applying delta to baseline
    const combinedVelocity = baselineMonthlyVelocity + combinedMonthlyDelta
    let projectedDate: string | null = null
    let cumulativeValue = currentValue

    const combinedTl: ForecastPoint[] = timeline.map((point, i) => {
      if (point.isHistorical) {
        return { ...point, projected: point.actual ?? point.projected }
      }
      cumulativeValue += combinedVelocity
      if (!projectedDate && cumulativeValue >= targetValue) {
        projectedDate = point.month
      }
      return {
        ...point,
        projected: Math.max(0, point.projected + combinedMonthlyDelta * (i + 1)),
      }
    })

    // If single scenario and it has its own timeline, use that (more accurate)
    const finalTimeline = activeScenarios.length === 1 && activeScenarios[0].scenarioTimeline
      ? activeScenarios[0].scenarioTimeline
      : combinedTl

    // Compute months shift
    let monthsShift = 0
    if (baselineProjectedDate && projectedDate) {
      const bDate = new Date(baselineProjectedDate)
      const sDate = new Date(projectedDate)
      monthsShift = (bDate.getFullYear() - sDate.getFullYear()) * 12 + (bDate.getMonth() - sDate.getMonth())
    } else if (activeScenarios.length === 1) {
      monthsShift = Math.round((activeScenarios[0].impact.daysSaved ?? 0) / 30)
    }

    const metrics: CombinedScenarioMetrics = {
      monthlyDelta: combinedMonthlyDelta,
      totalImpact,
      projectedDate,
      monthsShift,
      activeCount: activeScenarios.length,
    }

    return { combinedTimeline: finalTimeline, combinedMetrics: metrics }
  }, [activeScenarioIds, allScenarios, timeline, baselineMonthlyVelocity, baselineProjectedDate, currentValue, targetValue])

  // Scenario-aware summary card values
  const scenarioSummary = useMemo(() => {
    if (!summaryCards || !combinedMetrics) return null
    const delta = combinedMetrics.monthlyDelta
    const scenarioVelocity = summaryCards.monthlyVelocity + delta
    const scenarioProjectedDateLabel = combinedMetrics.projectedDate
      ? new Date(combinedMetrics.projectedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : summaryCards.projectedDateLabel

    // Recompute confidence: if velocity moves closer to required, confidence improves
    let scenarioConfidence = summaryCards.confidence
    const velocityRatio = summaryCards.requiredVelocity > 0
      ? scenarioVelocity / summaryCards.requiredVelocity
      : 1
    if (velocityRatio >= 1.1) scenarioConfidence = 'high'
    else if (velocityRatio >= 0.8) scenarioConfidence = 'medium'
    else scenarioConfidence = 'low'

    return {
      monthlyVelocity: scenarioVelocity,
      projectedDateLabel: scenarioProjectedDateLabel,
      monthsDiff: combinedMetrics.monthsShift + summaryCards.monthsDiff,
      confidence: scenarioConfidence,
    }
  }, [summaryCards, combinedMetrics])

  const isScenarioActive = combinedMetrics != null && combinedMetrics.activeCount > 0
  const scenarioLabel = useMemo(() => {
    if (!isScenarioActive) return ''
    const activeScenarios = allScenarios.filter(s => activeScenarioIds.includes(s.id))
    if (activeScenarios.length === 1) return activeScenarios[0].label
    return `${activeScenarios.length} scenarios`
  }, [isScenarioActive, allScenarios, activeScenarioIds])

  return (
    <>
      {/* Hero Timeline Chart */}
      <div className="card mb-6">
        <ForecastTimeline
          timeline={timeline}
          targetValue={targetValue}
          targetDate={targetDate}
          incomeTransitions={incomeTransitions}
          scenarioTimeline={combinedTimeline ?? undefined}
        />
      </div>

      {/* Active scenario banner */}
      {isScenarioActive && (
        <div className={`mb-4 flex flex-wrap items-center justify-between gap-2 rounded-card border px-4 py-2.5 ${
          combinedMetrics!.monthlyDelta >= 0
            ? 'border-pine/20 bg-pine/5'
            : 'border-ember/20 bg-ember/5'
        }`}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="text-fjord">
              Viewing: <span className="font-medium">{scenarioLabel}</span>
            </span>
            <span className={`font-semibold ${combinedMetrics!.monthlyDelta >= 0 ? 'text-pine' : 'text-ember'}`}>
              {combinedMetrics!.monthlyDelta >= 0 ? '+' : ''}{formatCurrency(combinedMetrics!.monthlyDelta)}/mo
            </span>
            {combinedMetrics!.monthsShift !== 0 && (
              <span className="text-stone">
                Goal {Math.abs(combinedMetrics!.monthsShift)} month{Math.abs(combinedMetrics!.monthsShift) !== 1 ? 's' : ''}{' '}
                {combinedMetrics!.monthsShift > 0 ? 'earlier' : 'later'}
              </span>
            )}
          </div>
          <button
            onClick={handleClearAll}
            className="text-xs font-medium text-fjord hover:text-pine"
          >
            Clear scenario{combinedMetrics!.activeCount > 1 ? 's' : ''}
          </button>
        </div>
      )}

      {/* Summary Cards — react to scenario state */}
      {summaryCards && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Velocity Breakdown Card */}
          <div className="card sm:col-span-2 lg:col-span-1">
            <p className="text-xs font-medium text-stone">Monthly savings estimate</p>
            <p className={`mt-1 font-mono text-2xl font-medium ${(isScenarioActive ? scenarioSummary!.monthlyVelocity : summaryCards.monthlyVelocity) >= 0 ? 'text-pine' : 'text-ember'}`}>
              {(isScenarioActive ? scenarioSummary!.monthlyVelocity : summaryCards.monthlyVelocity) < 0 ? '-' : ''}
              {formatCurrency(Math.abs(isScenarioActive ? scenarioSummary!.monthlyVelocity : summaryCards.monthlyVelocity))}
            </p>
            <p className="mt-1 text-xs text-stone">/month blended estimate</p>
            {isScenarioActive && combinedMetrics && (
              <p className="mt-1 text-xs">
                <span className="text-stone">Baseline {formatCurrency(summaryCards.monthlyVelocity)} → </span>
                <span className={combinedMetrics.monthlyDelta >= 0 ? 'font-medium text-pine' : 'font-medium text-ember'}>
                  {formatCurrency(scenarioSummary!.monthlyVelocity)} with scenario
                </span>
              </p>
            )}
            {!isScenarioActive && summaryCards.velocityBreakdown && (
              <div className="mt-3 space-y-1.5 border-t border-mist pt-2">
                {summaryCards.velocityBreakdown.plan.weight > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone">Budget plan</span>
                    <span className="font-mono text-fjord">
                      {formatCurrency(summaryCards.velocityBreakdown.plan.value)} ({Math.round(summaryCards.velocityBreakdown.plan.weight * 100)}%)
                    </span>
                  </div>
                )}
                {summaryCards.velocityBreakdown.recent.weight > 0 && summaryCards.velocityBreakdown.recent.value != null && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone">Recent (3mo)</span>
                    <span className="font-mono text-fjord">
                      {formatCurrency(summaryCards.velocityBreakdown.recent.value)} ({Math.round(summaryCards.velocityBreakdown.recent.weight * 100)}%)
                    </span>
                  </div>
                )}
                {summaryCards.velocityBreakdown.trend.weight > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone">Historical trend</span>
                    <span className="font-mono text-fjord">
                      {formatCurrency(summaryCards.velocityBreakdown.trend.value)} ({Math.round(summaryCards.velocityBreakdown.trend.weight * 100)}%)
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Needed Monthly */}
          <div className="card">
            <p className="text-xs font-medium text-stone">Needed monthly</p>
            <p className="mt-1 font-mono text-2xl font-medium text-fjord">
              {formatCurrency(Math.abs(summaryCards.requiredVelocity))}
            </p>
            <p className="mt-1 text-xs text-stone">/month to stay on track</p>
          </div>

          {/* Projected Completion */}
          <div className="card">
            <p className="text-xs font-medium text-stone">Projected completion</p>
            <p className="mt-1 font-mono text-xl font-medium text-fjord">
              {isScenarioActive ? scenarioSummary!.projectedDateLabel : summaryCards.projectedDateLabel}
            </p>
            {(() => {
              const diff = isScenarioActive ? scenarioSummary!.monthsDiff : summaryCards.monthsDiff
              return diff !== 0 ? (
                <p className={`mt-1 text-xs font-medium ${diff > 0 ? 'text-pine' : 'text-ember'}`}>
                  {Math.abs(diff)} month{Math.abs(diff) !== 1 ? 's' : ''}{' '}
                  {diff > 0 ? 'early' : 'late'}
                </p>
              ) : null
            })()}
            {isScenarioActive && combinedMetrics!.monthsShift !== 0 && (
              <p className="mt-0.5 text-[10px] text-stone">
                Baseline: {summaryCards.projectedDateLabel}
              </p>
            )}
          </div>

          {/* Confidence */}
          <div className="card">
            <p className="text-xs font-medium text-stone">Confidence</p>
            <p className="mt-1">
              {(() => {
                const conf = isScenarioActive ? scenarioSummary!.confidence : summaryCards.confidence
                return (
                  <span className={`inline-flex items-center rounded-badge px-2 py-0.5 text-sm font-medium ${
                    conf === 'high' ? 'bg-pine/10 text-pine' : conf === 'medium' ? 'bg-birch/20 text-midnight' : 'bg-ember/10 text-ember'
                  }`}>
                    {conf.charAt(0).toUpperCase() + conf.slice(1)}
                  </span>
                )
              })()}
            </p>
            <p className="mt-1 text-xs text-stone">{summaryCards.confidenceReason}</p>
            {isScenarioActive && scenarioSummary!.confidence !== summaryCards.confidence && (
              <p className="mt-0.5 text-[10px] text-pine">
                Would improve to {scenarioSummary!.confidence} with scenario
              </p>
            )}
          </div>
        </div>
      )}

      {/* Progress Bar — react to scenario state */}
      {summaryCards && (
        <div className="card mb-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-fjord">{summaryCards.paceDetail}</span>
            <span className="font-mono text-stone">{summaryCards.progressPercent.toFixed(1)}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-bar bg-mist">
            <div
              className={`h-full rounded-bar transition-all ${summaryCards.pace === 'ahead' || summaryCards.pace === 'on_track' ? 'bg-pine' : summaryCards.pace === 'behind' ? 'bg-birch' : 'bg-ember'}`}
              style={{ width: `${Math.min(100, summaryCards.progressPercent)}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-stone">
            <span>{formatCurrency(summaryCards.currentValue)}</span>
            <span>Target: {formatCurrency(targetValue)}</span>
          </div>
          {isScenarioActive && combinedMetrics!.monthsShift > 0 && (
            <p className="mt-1 text-xs text-pine">
              With scenario: on track for {scenarioSummary!.projectedDateLabel}
            </p>
          )}
        </div>
      )}

      {/* Growth Assumption */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-fjord">Growth assumption</h2>
        </div>
        <div className="flex rounded-button bg-frost overflow-hidden border border-mist">
          {GROWTH_PROFILES.map(profile => (
            <button
              key={profile.id}
              onClick={() => setGrowthProfile(profile.id)}
              className={`flex-1 px-2 py-2 text-xs font-medium transition-colors ${
                growthProfile === profile.id
                  ? 'bg-fjord text-snow'
                  : 'text-stone hover:text-fjord'
              }`}
            >
              {profile.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-stone">
          {GROWTH_PROFILES.find(p => p.id === growthProfile)?.description}
          {growthProfile !== 'current' && ' — checking/savings rates unchanged.'}
        </p>

        {/* Per-account growth rates */}
        {assetGrowth && assetGrowth.length > 0 && (
          <div className="mt-3 space-y-2 border-t border-mist pt-3">
            {assetGrowth.map(ag => {
              const accountType = ag.assetClass.toUpperCase()
              const defaultRate = GROWTH_DEFAULTS_BY_TYPE[accountType] ?? 3
              const profileRate = growthProfile === 'current'
                ? defaultRate
                : (GROWTH_PROFILES_BY_TYPE[growthProfile]?.[accountType] ?? defaultRate)
              const adjustedGrowth = ag.currentBalance * (profileRate / 100)
              return (
                <div key={ag.accountId} className="flex items-center justify-between text-xs">
                  <span className="text-fjord">{ag.accountName}</span>
                  <span className="font-mono text-stone">
                    {profileRate}%/yr → {formatCurrency(adjustedGrowth)}/yr
                  </span>
                </div>
              )
            })}
          </div>
        )}

        <p className="mt-2 text-[10px] text-stone/70">
          Projected returns are estimates based on historical averages. Past performance does not guarantee future results.
        </p>
      </div>

      {/* What-If Scenarios */}
      <div className="card mb-6">
        <h2 className="mb-4 text-base font-semibold text-fjord">What-If Scenarios</h2>
        <ForecastScenarios
          scenarios={scenarios}
          customScenarios={customScenarios}
          activeScenarioIds={activeScenarioIds}
          onScenarioToggle={handleScenarioToggle}
          onCustomScenarioAdd={handleCustomScenarioAdd}
          onCustomScenarioRemove={handleCustomScenarioRemove}
          baselineProjectedDate={baselineProjectedDate}
          debts={debts}
        />
      </div>

      {/* Monthly Breakdown — reacts to scenario */}
      <div className="card">
        <h2 className="mb-4 text-base font-semibold text-fjord">Monthly Breakdown</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-mist text-left text-xs font-medium text-stone">
                <th className="pb-2 pr-4">Month</th>
                <th className="pb-2 pr-4 text-right">Projected</th>
                {isScenarioActive && (
                  <th className="pb-2 pr-4 text-right">With scenario</th>
                )}
                <th className="pb-2 pr-4 text-right">On plan</th>
                <th className="pb-2 pr-4 text-right">Actual</th>
                <th className="pb-2 text-right">Delta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist/50">
              {timeline.slice(0, 24).map((point) => {
                const delta = point.projected - point.onPlan
                const isProjectedCompletion =
                  baselineProjectedDate && point.month === baselineProjectedDate.slice(0, 7)
                const scenarioPoint = isScenarioActive && combinedTimeline
                  ? combinedTimeline.find(p => p.month === point.month)
                  : null
                const isScenarioCompletion = isScenarioActive && combinedMetrics?.projectedDate
                  && point.month === combinedMetrics.projectedDate.slice(0, 7)
                return (
                  <tr
                    key={point.month}
                    className={isScenarioCompletion ? 'bg-pine/5' : isProjectedCompletion ? 'bg-frost' : ''}
                  >
                    <td className="py-2 pr-4 text-fjord">
                      {point.month}
                      {point.isHistorical && (
                        <span className="ml-1 text-xs text-stone">(past)</span>
                      )}
                    </td>
                    <td className={`py-2 pr-4 text-right font-mono ${isScenarioActive ? 'text-stone' : 'text-fjord'}`}>
                      {formatCurrency(point.projected)}
                    </td>
                    {isScenarioActive && (
                      <td className="py-2 pr-4 text-right font-mono text-pine">
                        {scenarioPoint ? formatCurrency(scenarioPoint.projected) : '—'}
                      </td>
                    )}
                    <td className="py-2 pr-4 text-right font-mono text-stone">
                      {formatCurrency(point.onPlan)}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono text-fjord">
                      {point.actual != null ? formatCurrency(point.actual) : '—'}
                    </td>
                    <td className={`py-2 text-right font-mono text-xs ${delta >= 0 ? 'text-pine' : 'text-ember'}`}>
                      {delta >= 0 ? '+' : ''}{formatCurrency(delta)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

export type { CombinedScenarioMetrics, SummaryCardData, AssetGrowthItem }
