'use client'

import { useState, useCallback, useMemo } from 'react'
import ForecastTimeline from './ForecastTimelineLazy'
import ForecastScenarios from './ForecastScenarios'
import type { ForecastPoint, ForecastScenario, IncomeTransition, AssetGrowthProjection, AssetClass } from '@/types'

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
  projectedDateLabel: string
  confidence: 'high' | 'medium' | 'low'
  confidenceDetail: string
  monthsDiff: number
}

interface PropertyEquityGrowth {
  annualAppreciation: number
  annualPrincipalPaydown: number
  annualTotal: number
  properties: { name: string; appreciation: number; principalPaydown: number }[]
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
  summaryCards: SummaryCardData
  assetGrowth: AssetGrowthProjection[]
  assetClassLabels: Record<string, string>
  propertyEquityGrowth: PropertyEquityGrowth | null
  isSavingsGoal: boolean
}

const SAVINGS_RISK_OPTIONS = [
  { id: 'hysa', label: 'HYSA', rate: 4.5, description: 'High-yield savings account. FDIC insured, no risk to principal.' },
  { id: 'cd', label: 'CD', rate: 4.8, description: 'Certificate of deposit. Locked term, slightly higher yield.' },
  { id: 'bonds', label: 'Bonds', rate: 4.0, description: 'Bond funds. Low volatility, some interest rate risk.' },
  { id: 'index', label: 'Index', rate: 10.0, description: 'S&P 500 index fund. Historical average ~10%/yr, volatile short-term.' },
  { id: 'growth', label: 'Growth', rate: 12.0, description: 'Growth equities. Higher potential return with higher risk.' },
]

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
  assetClassLabels,
  propertyEquityGrowth,
  isSavingsGoal,
}: Props) {
  const [activeScenarioIds, setActiveScenarioIds] = useState<string[]>([])
  const [savingsRisk, setSavingsRisk] = useState<string>('hysa')
  const [dismissedScenarioIds, setDismissedScenarioIds] = useState<string[]>([])

  // All scenarios including custom ones added by ForecastScenarios
  const [customScenarios, setCustomScenarios] = useState<ForecastScenario[]>([])
  const allScenarios = useMemo(() => [...scenarios, ...customScenarios], [scenarios, customScenarios])

  // Filter out dismissed auto-generated scenarios
  const visibleScenarios = useMemo(
    () => scenarios.filter(s => !dismissedScenarioIds.includes(s.id)),
    [scenarios, dismissedScenarioIds]
  )

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

  const handleScenarioDismiss = useCallback((id: string) => {
    setDismissedScenarioIds(prev => [...prev, id])
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

  // Recalculate asset growth based on savings risk slider
  const adjustedAssetGrowth = useMemo(() => {
    const selectedRate = (SAVINGS_RISK_OPTIONS.find(o => o.id === savingsRisk)?.rate ?? 4.5) / 100
    return assetGrowth.map(ag => {
      const projected = ag.currentBalance * (1 + selectedRate)
      const growth = projected - ag.currentBalance
      const volatility = selectedRate * 0.3 // rough uncertainty
      return {
        ...ag,
        projectedBalance12mo: projected,
        expectedGrowth: growth,
        uncertaintyRange: {
          low: ag.currentBalance * (1 + selectedRate - volatility),
          high: ag.currentBalance * (1 + selectedRate + volatility),
        },
      }
    })
  }, [assetGrowth, savingsRisk])

  // Effective summary card values (adjusted when scenarios active)
  const effectiveVelocity = combinedMetrics
    ? summaryCards.monthlyVelocity + combinedMetrics.monthlyDelta
    : summaryCards.monthlyVelocity

  const effectiveProjectedLabel = combinedMetrics?.projectedDate
    ? new Date(combinedMetrics.projectedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : summaryCards.projectedDateLabel

  const effectiveMonthsDiff = combinedMetrics
    ? combinedMetrics.monthsShift + summaryCards.monthsDiff
    : summaryCards.monthsDiff

  const hasActiveScenarios = combinedMetrics != null && combinedMetrics.activeCount > 0

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

      {/* Combined scenario summary bar */}
      {combinedMetrics && combinedMetrics.activeCount > 0 && (
        <div className={`mb-4 flex flex-wrap items-center justify-between gap-2 rounded-card border px-4 py-2.5 ${
          combinedMetrics.monthlyDelta >= 0
            ? 'border-pine/20 bg-pine/5'
            : 'border-ember/20 bg-ember/5'
        }`}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className={`font-semibold ${combinedMetrics.monthlyDelta >= 0 ? 'text-pine' : 'text-ember'}`}>
              Combined: {combinedMetrics.monthlyDelta >= 0 ? '+' : ''}{formatCurrency(combinedMetrics.monthlyDelta)}/mo
            </span>
            {combinedMetrics.monthsShift !== 0 && (
              <span className="text-stone">
                Goal {Math.abs(combinedMetrics.monthsShift)} month{Math.abs(combinedMetrics.monthsShift) !== 1 ? 's' : ''}{' '}
                {combinedMetrics.monthsShift > 0 ? 'earlier' : 'later'}
              </span>
            )}
            <span className="text-xs text-stone">
              {combinedMetrics.activeCount} scenario{combinedMetrics.activeCount !== 1 ? 's' : ''} active
            </span>
          </div>
          <button
            onClick={handleClearAll}
            className="text-xs font-medium text-fjord hover:text-pine"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Summary Cards — react to active scenarios */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card sm:col-span-2 lg:col-span-1">
          <p className="text-xs font-medium text-stone">
            Monthly savings estimate
            {hasActiveScenarios && <span className="ml-1 text-pine">(with scenario)</span>}
          </p>
          <p className={`mt-1 font-mono text-2xl font-medium ${effectiveVelocity >= 0 ? 'text-pine' : 'text-ember'}`}>
            {effectiveVelocity < 0 ? '-' : ''}{formatCurrency(Math.abs(effectiveVelocity))}
          </p>
          <p className="mt-1 text-xs text-stone">/month blended estimate</p>
          {hasActiveScenarios && combinedMetrics && (
            <p className={`mt-1 text-xs font-medium ${combinedMetrics.monthlyDelta >= 0 ? 'text-pine' : 'text-ember'}`}>
              {combinedMetrics.monthlyDelta >= 0 ? '+' : ''}{formatCurrency(combinedMetrics.monthlyDelta)}/mo from baseline
            </p>
          )}
        </div>
        <div className="card">
          <p className="text-xs font-medium text-stone">Needed monthly</p>
          <p className="mt-1 font-mono text-2xl font-medium text-fjord">
            {formatCurrency(Math.abs(summaryCards.requiredVelocity))}
          </p>
          <p className="mt-1 text-xs text-stone">/month to stay on track</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium text-stone">
            Projected completion
            {hasActiveScenarios && <span className="ml-1 text-pine">(with scenario)</span>}
          </p>
          <p className="mt-1 font-mono text-xl font-medium text-fjord">{effectiveProjectedLabel}</p>
          {effectiveMonthsDiff !== 0 && (
            <p className={`mt-1 text-xs font-medium ${effectiveMonthsDiff > 0 ? 'text-pine' : 'text-ember'}`}>
              {Math.abs(effectiveMonthsDiff)} month{Math.abs(effectiveMonthsDiff) !== 1 ? 's' : ''}{' '}
              {effectiveMonthsDiff > 0 ? 'early' : 'late'}
            </p>
          )}
        </div>
        <div className="card">
          <p className="text-xs font-medium text-stone">Confidence</p>
          <p className="mt-1">
            <span
              className={`inline-flex items-center rounded-badge px-2 py-0.5 text-sm font-medium ${
                summaryCards.confidence === 'high'
                  ? 'bg-pine/10 text-pine'
                  : summaryCards.confidence === 'medium'
                    ? 'bg-birch/20 text-midnight'
                    : 'bg-ember/10 text-ember'
              }`}
            >
              {summaryCards.confidence.charAt(0).toUpperCase() + summaryCards.confidence.slice(1)}
            </span>
          </p>
          <p className="mt-1 text-xs text-stone">{summaryCards.confidenceDetail}</p>
        </div>
      </div>

      {/* Savings Growth Assumption */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-fjord">Growth assumption</h2>
          <span className="font-mono text-sm text-pine">
            {SAVINGS_RISK_OPTIONS.find(o => o.id === savingsRisk)?.rate ?? 0}%/yr
          </span>
        </div>
        <div className="flex rounded-button bg-frost overflow-hidden border border-mist">
          {SAVINGS_RISK_OPTIONS.map(option => (
            <button
              key={option.id}
              onClick={() => setSavingsRisk(option.id)}
              className={`flex-1 px-2 py-2 text-xs font-medium transition-colors ${
                savingsRisk === option.id
                  ? 'bg-fjord text-snow'
                  : 'text-stone hover:text-fjord'
              }`}
            >
              <div>{option.label}</div>
              <div className={`text-[10px] font-mono ${savingsRisk === option.id ? 'text-snow/70' : 'text-stone/70'}`}>
                {option.rate}%
              </div>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-stone">
          {SAVINGS_RISK_OPTIONS.find(o => o.id === savingsRisk)?.description}
        </p>
      </div>

      {/* Asset Growth Projections — reacts to savings risk slider */}
      {adjustedAssetGrowth.length > 0 && (
        <div className="card mb-6">
          <h2 className="mb-4 text-base font-semibold text-fjord">Asset Growth Projections (12mo)</h2>
          <div className="space-y-3">
            {adjustedAssetGrowth.map((ag) => (
              <div key={ag.accountId} className="flex items-center justify-between rounded-lg border border-mist bg-frost/30 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-fjord">{ag.accountName}</p>
                  <p className="text-xs text-stone">
                    {assetClassLabels[ag.assetClass] ?? ag.assetClass}
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
                +{formatCurrency(adjustedAssetGrowth.reduce((s, a) => s + a.expectedGrowth, 0))}
              </span>
            </div>
            {propertyEquityGrowth && propertyEquityGrowth.annualTotal > 0 && (
              <div className="border-t border-mist pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-fjord">Property Equity Growth</p>
                    <p className="text-xs text-stone">
                      {isSavingsGoal
                        ? 'Not included in savings target — shown for context'
                        : `${propertyEquityGrowth.properties.length} propert${propertyEquityGrowth.properties.length === 1 ? 'y' : 'ies'} — appreciation + paydown`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-pine">
                      +{formatCurrency(propertyEquityGrowth.annualTotal)}/yr
                    </p>
                  </div>
                </div>
                {propertyEquityGrowth.properties.length > 1 && (
                  <div className="space-y-1 pl-2">
                    {propertyEquityGrowth.properties.map((p) => (
                      <div key={p.name} className="flex items-center justify-between text-xs text-stone">
                        <span>{p.name}</span>
                        <span>
                          +{formatCurrency(p.appreciation)} appreciation
                          {p.principalPaydown > 0 ? ` + ${formatCurrency(p.principalPaydown)} paydown` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* What-If Scenarios */}
      <div className="card mb-6">
        <h2 className="mb-4 text-base font-semibold text-fjord">What-If Scenarios</h2>
        <ForecastScenarios
          scenarios={visibleScenarios}
          customScenarios={customScenarios}
          activeScenarioIds={activeScenarioIds}
          onScenarioToggle={handleScenarioToggle}
          onCustomScenarioAdd={handleCustomScenarioAdd}
          onCustomScenarioRemove={handleCustomScenarioRemove}
          onScenarioDismiss={handleScenarioDismiss}
          baselineProjectedDate={baselineProjectedDate}
          debts={debts}
        />
      </div>
    </>
  )
}

export type { CombinedScenarioMetrics }
