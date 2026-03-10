'use client'

import { useState, useCallback } from 'react'
import ForecastTimeline from './ForecastTimelineLazy'
import ForecastScenarios from './ForecastScenarios'
import type { ForecastPoint, ForecastScenario, IncomeTransition } from '@/types'

interface ScenarioMetrics {
  monthlyVelocity: number
  projectedDate: string | null
}

interface Props {
  timeline: ForecastPoint[]
  targetValue: number
  targetDate?: string
  incomeTransitions: IncomeTransition[]
  scenarios: ForecastScenario[]
  baselineProjectedDate: string | null
  baselineMonthlyVelocity: number
}

export default function ForecastInteractive({
  timeline,
  targetValue,
  targetDate,
  incomeTransitions,
  scenarios,
  baselineProjectedDate,
  baselineMonthlyVelocity,
}: Props) {
  const [activeScenarioTimeline, setActiveScenarioTimeline] = useState<ForecastPoint[] | null>(null)
  const [scenarioMetrics, setScenarioMetrics] = useState<ScenarioMetrics | null>(null)

  const handleScenarioSelect = useCallback((scenario: ForecastScenario) => {
    setActiveScenarioTimeline(scenario.scenarioTimeline || null)
    setScenarioMetrics({
      monthlyVelocity: baselineMonthlyVelocity + (scenario.impact.monthlyImpactOnTrueRemaining ?? 0),
      projectedDate: scenario.scenarioProjectedDate ?? scenario.impact.newProjectedDate ?? null,
    })
  }, [baselineMonthlyVelocity])

  const handleScenarioClear = useCallback(() => {
    setActiveScenarioTimeline(null)
    setScenarioMetrics(null)
  }, [])

  return (
    <>
      {/* Hero Timeline Chart */}
      <div className="card mb-6">
        <ForecastTimeline
          timeline={timeline}
          targetValue={targetValue}
          targetDate={targetDate}
          incomeTransitions={incomeTransitions}
          scenarioTimeline={activeScenarioTimeline ?? undefined}
        />
      </div>

      {/* Scenario-aware summary indicator */}
      {scenarioMetrics && (
        <div className="mb-4 flex items-center justify-between rounded-card border border-pine/20 bg-pine/5 px-4 py-2">
          <span className="text-xs text-stone">
            Viewing with scenario applied
          </span>
          <button
            onClick={handleScenarioClear}
            className="text-xs font-medium text-fjord hover:text-pine"
          >
            Clear scenario
          </button>
        </div>
      )}

      {/* What-If Scenarios */}
      <div className="card mb-6">
        <h2 className="mb-4 text-base font-semibold text-fjord">What-If Scenarios</h2>
        <ForecastScenarios
          scenarios={scenarios}
          onScenarioSelect={handleScenarioSelect}
          onScenarioClear={handleScenarioClear}
          baselineProjectedDate={baselineProjectedDate}
        />
      </div>
    </>
  )
}

export type { ScenarioMetrics }
