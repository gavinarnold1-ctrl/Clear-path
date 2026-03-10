'use client'

import { useState, useCallback, useMemo } from 'react'
import ForecastTimeline from './ForecastTimelineLazy'
import ForecastScenarios from './ForecastScenarios'
import type { ForecastPoint, ForecastScenario, IncomeTransition } from '@/types'

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
}: Props) {
  const [activeScenarioIds, setActiveScenarioIds] = useState<string[]>([])

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
    </>
  )
}

export type { CombinedScenarioMetrics }
