'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import ForecastTimeline from './ForecastTimelineLazy'
import ForecastScenarios from './ForecastScenarios'
import type { ForecastPoint, ForecastScenario, IncomeTransition, VelocityBreakdown, AssetGrowthProjection } from '@/types'
import type { Forecast } from '@/types'
import { parseLocalDate, normalizeAccountName } from '@/lib/utils'
import { trackIncomeTransitionViewed } from '@/lib/analytics'

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
  propertyGroupId?: string | null
  propertyGroupName?: string | null
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

interface PropertyEquityGrowth {
  annualAppreciation: number
  annualPrincipalPaydown: number
  annualTotal: number
  properties: { name: string; appreciation: number; principalPaydown: number }[]
}

// Growth assumption profiles
const GROWTH_PROFILES = [
  { id: 'current', label: 'Current', description: 'Per-account-type defaults' },
  { id: 'conservative', label: 'Conservative', description: 'Lower risk, stable returns' },
  { id: 'moderate', label: 'Moderate', description: 'Balanced risk and return' },
  { id: 'aggressive', label: 'Aggressive', description: 'Higher potential return' },
] as const

const GROWTH_DEFAULTS_BY_CLASS: Record<string, number> = {
  cash: 0,
  high_yield_savings: 4.5,
  bonds: 4.0,
  index_fund: 10.0,
  mutual_fund: 8.0,
  individual_stock: 10.0,
  crypto: 15.0,
  real_estate: 3.0,
  other: 3.0,
}

const GROWTH_PROFILES_BY_CLASS: Record<string, Record<string, number>> = {
  conservative: { cash: 0, high_yield_savings: 4.0, bonds: 3.5, index_fund: 5.0, mutual_fund: 5.0, individual_stock: 5.0, crypto: 5.0, real_estate: 2.0, other: 2.0 },
  moderate: { cash: 0, high_yield_savings: 4.5, bonds: 4.0, index_fund: 8.0, mutual_fund: 8.0, individual_stock: 8.0, crypto: 10.0, real_estate: 3.0, other: 3.0 },
  aggressive: { cash: 0, high_yield_savings: 4.5, bonds: 4.0, index_fund: 10.0, mutual_fund: 10.0, individual_stock: 12.0, crypto: 20.0, real_estate: 5.0, other: 5.0 },
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
  const [growthProfile, setGrowthProfile] = useState<string>('current')
  const [dismissedScenarioIds, setDismissedScenarioIds] = useState<string[]>([])
  const [editingRateId, setEditingRateId] = useState<string | null>(null)
  const [editingRateValue, setEditingRateValue] = useState<string>('')
  const [overriddenRates, setOverriddenRates] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {}
    for (const ag of assetGrowth) {
      if (ag.expectedReturn != null) {
        initial[ag.accountId] = Math.round(ag.expectedReturn * 1000) / 10
      }
    }
    return initial
  })

  // Track income transition viewed on mount
  useEffect(() => {
    if (incomeTransitions.length > 0) {
      const nextTransition = incomeTransitions
        .filter(t => new Date(t.date) > new Date())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]
      const monthsUntil = nextTransition
        ? Math.round((new Date(nextTransition.date).getTime() - Date.now()) / (30.44 * 24 * 60 * 60 * 1000))
        : 0
      trackIncomeTransitionViewed(incomeTransitions.length, monthsUntil)
    }
  }, []) // Only fire once on mount

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

  const handleRateSave = useCallback(async (accountId: string) => {
    const parsed = parseFloat(editingRateValue)
    if (isNaN(parsed) || parsed < 0 || parsed > 100) {
      setEditingRateId(null)
      return
    }
    const decimal = parsed / 100
    try {
      const res = await fetch(`/api/accounts/${accountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedReturn: decimal }),
      })
      if (res.ok) {
        setOverriddenRates(prev => ({ ...prev, [accountId]: parsed }))
      }
    } catch { /* ignore */ }
    setEditingRateId(null)
  }, [editingRateValue])

  const handleRateReset = useCallback(async (accountId: string) => {
    try {
      await fetch(`/api/accounts/${accountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedReturn: null }),
      })
      setOverriddenRates(prev => {
        const next = { ...prev }
        delete next[accountId]
        return next
      })
    } catch { /* ignore */ }
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
    if (!combinedMetrics) return null
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

  // Adjust asset growth based on growth profile
  const adjustedAssetGrowth = useMemo(() => {
    if (growthProfile === 'current') return assetGrowth
    return assetGrowth.map(ag => {
      const profileRate = (GROWTH_PROFILES_BY_CLASS[growthProfile]?.[ag.assetClass] ?? GROWTH_DEFAULTS_BY_CLASS[ag.assetClass] ?? 3) / 100
      const projected = ag.currentBalance * (1 + profileRate)
      const growth = projected - ag.currentBalance
      const volatility = profileRate * 0.3
      return {
        ...ag,
        projectedBalance12mo: projected,
        expectedGrowth: growth,
        uncertaintyRange: {
          low: ag.currentBalance * (1 + profileRate - volatility),
          high: ag.currentBalance * (1 + profileRate + volatility),
        },
      }
    })
  }, [assetGrowth, growthProfile])

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

      {/* Income transition summary card */}
      {incomeTransitions.length > 0 && (() => {
        const now = new Date()
        const futureTransitions = incomeTransitions
          .filter((t) => new Date(t.date) > now)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        const nextTransition = futureTransitions[0]
        if (!nextTransition) return null

        // Find the most recent past transition or use baselineMonthlyVelocity as proxy for current income
        const pastTransitions = incomeTransitions
          .filter((t) => new Date(t.date) <= now)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        const currentIncome = pastTransitions.length > 0
          ? pastTransitions[0].monthlyIncome
          : baselineMonthlyVelocity

        const isIncrease = nextTransition.monthlyIncome > currentIncome
        const transitionDate = parseLocalDate(nextTransition.date)
        const monthsAway = Math.max(0, Math.round((transitionDate.getTime() - now.getTime()) / (30.44 * 24 * 60 * 60 * 1000)))

        return (
          <div className={`mb-4 rounded-card border px-4 py-3 ${isIncrease ? 'border-pine/20 bg-pine/5' : 'border-ember/20 bg-ember/5'}`}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className={`font-semibold ${isIncrease ? 'text-pine' : 'text-ember'}`}>
                {nextTransition.label}
              </span>
              <span className="text-fjord">
                Income {isIncrease ? 'increases' : 'decreases'} to{' '}
                <span className="font-mono font-semibold">{formatCurrency(nextTransition.monthlyIncome)}</span>/mo
              </span>
              <span className="text-stone">
                {transitionDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                {monthsAway > 0 && ` (${monthsAway} month${monthsAway !== 1 ? 's' : ''} away)`}
              </span>
            </div>
            {futureTransitions.length > 1 && (
              <p className="mt-1 text-xs text-stone">
                +{futureTransitions.length - 1} more planned income change{futureTransitions.length - 1 !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        )
      })()}

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

      {/* Progress Bar — react to scenario state */}
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

      {/* Growth Assumption */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-fjord">Growth Assumptions</h2>
        </div>
        <p className="text-xs text-stone mb-3">
          Growth rates are applied to project your account balances forward. Rates are based on historical averages for each account type.
        </p>
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
          {growthProfile === 'current'
            ? 'Using default rates for each account type.'
            : GROWTH_PROFILES.find(p => p.id === growthProfile)?.description + ' — checking/savings rates unchanged.'}
        </p>

        {/* Per-account growth rates with projected gain — inline editable */}
        {assetGrowth.length > 0 && (
          <div className="mt-3 space-y-2 border-t border-mist pt-3">
            {assetGrowth.map(ag => {
              const defaultRate = GROWTH_DEFAULTS_BY_CLASS[ag.assetClass] ?? 3
              const hasOverride = ag.accountId in overriddenRates
              const displayRate = hasOverride
                ? overriddenRates[ag.accountId]
                : growthProfile === 'current'
                  ? defaultRate
                  : (GROWTH_PROFILES_BY_CLASS[growthProfile]?.[ag.assetClass] ?? defaultRate)
              const adjustedGrowth = ag.currentBalance * (displayRate / 100)
              const isEditing = editingRateId === ag.accountId
              return (
                <div key={ag.accountId} className="flex items-center justify-between text-xs">
                  <div className="min-w-0 flex-1">
                    <span className="text-fjord">{normalizeAccountName(ag.accountName)}</span>
                    <span className="ml-1 text-stone">({formatCurrency(ag.currentBalance)})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isEditing ? (
                      <form
                        onSubmit={(e) => { e.preventDefault(); handleRateSave(ag.accountId) }}
                        className="flex items-center gap-1"
                      >
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          autoFocus
                          value={editingRateValue}
                          onChange={(e) => setEditingRateValue(e.target.value)}
                          onBlur={() => handleRateSave(ag.accountId)}
                          className="w-14 rounded-badge border border-mist bg-snow px-1.5 py-0.5 text-right font-mono text-xs text-fjord focus:border-fjord focus:outline-none"
                        />
                        <span className="text-stone">%</span>
                      </form>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingRateId(ag.accountId)
                          setEditingRateValue(String(displayRate))
                        }}
                        className="group flex items-center gap-1 font-mono text-stone transition-colors hover:text-fjord"
                        title="Click to edit growth rate"
                      >
                        <span>{displayRate}%</span>
                        {hasOverride && (
                          <span className="rounded-badge bg-pine/10 px-1 text-[9px] text-pine">custom</span>
                        )}
                        <svg className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                        </svg>
                      </button>
                    )}
                    <span className="font-mono text-stone">
                      → <span className={adjustedGrowth > 0 ? 'text-pine' : ''}>{adjustedGrowth > 0 ? '+' : ''}{formatCurrency(adjustedGrowth)}/yr</span>
                    </span>
                    {hasOverride && !isEditing && (
                      <button
                        onClick={() => handleRateReset(ag.accountId)}
                        className="ml-0.5 text-stone/50 transition-colors hover:text-ember"
                        title="Reset to default"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {assetGrowth.length === 0 && (
          <p className="mt-3 text-xs text-stone">No asset accounts with positive balances. Add savings or investment accounts to see growth projections.</p>
        )}

        {/* Rate explanations */}
        <div className="mt-3 rounded-lg bg-frost/50 px-3 py-2">
          <p className="text-[10px] font-medium text-stone mb-1">Default rates</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] text-stone/80">
            <span>Checking: 0% (no interest)</span>
            <span>Savings: 4.5% (high-yield avg)</span>
            <span>Investment: 8% (S&amp;P 500 avg)</span>
            <span>Cash: 0% (no interest)</span>
          </div>
        </div>

        <p className="mt-2 text-[10px] text-stone/70">
          Projected returns are estimates based on historical averages. Past performance does not guarantee future results.
        </p>
      </div>

      {/* Asset Growth Projections — reacts to growth profile */}
      {adjustedAssetGrowth.length > 0 && (
        <div className="card mb-6">
          <h2 className="mb-4 text-base font-semibold text-fjord">Asset Growth Projections (12mo)</h2>
          <div className="space-y-3">
            {adjustedAssetGrowth.map((ag) => (
              <div key={ag.accountId} className="flex items-center justify-between rounded-lg border border-mist bg-frost/30 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-fjord">{normalizeAccountName(ag.accountName)}</p>
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
            {(() => {
              // Use scenario's property equity growth when a single scenario is active
              const activeScenarios = allScenarios.filter(s => activeScenarioIds.includes(s.id))
              const scenarioPEG = activeScenarios.length === 1
                ? activeScenarios[0].propertyEquityGrowth
                : null
              const activePEG = scenarioPEG ?? propertyEquityGrowth
              if (!activePEG || activePEG.annualTotal <= 0) return null

              const baselinePrincipal = propertyEquityGrowth?.annualPrincipalPaydown ?? 0
              const scenarioPrincipal = activePEG.annualPrincipalPaydown
              const principalDelta = scenarioPEG ? scenarioPrincipal - baselinePrincipal : 0

              return (
                <div className="border-t border-mist pt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-fjord">Property Equity Growth</p>
                      <p className="text-xs text-stone">
                        {isSavingsGoal
                          ? 'Not included in savings target — shown for context'
                          : `${activePEG.properties.length} propert${activePEG.properties.length === 1 ? 'y' : 'ies'} — appreciation + paydown`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-pine">
                        +{formatCurrency(activePEG.annualTotal)}/yr
                      </p>
                      {principalDelta > 0 && (
                        <p className="text-xs text-pine">
                          +{formatCurrency(principalDelta)}/yr more paydown with scenario
                        </p>
                      )}
                    </div>
                  </div>
                  {activePEG.properties.length > 1 && (
                    <div className="space-y-1 pl-2">
                      {activePEG.properties.map((p) => (
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
              )
            })()}
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
          incomeTransitions={incomeTransitions}
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

export type { CombinedScenarioMetrics, SummaryCardData }
