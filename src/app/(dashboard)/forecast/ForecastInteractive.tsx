'use client'

import { useState } from 'react'
import ForecastTimeline from './ForecastTimelineLazy'
import ForecastScenarios from './ForecastScenarios'
import type { ForecastPoint, ForecastScenario, IncomeTransition } from '@/types'

interface Props {
  timeline: ForecastPoint[]
  targetValue: number
  targetDate?: string
  incomeTransitions: IncomeTransition[]
  scenarios: ForecastScenario[]
  baselineProjectedDate: string | null
}

export default function ForecastInteractive({
  timeline,
  targetValue,
  targetDate,
  incomeTransitions,
  scenarios,
  baselineProjectedDate,
}: Props) {
  const [activeScenarioTimeline, setActiveScenarioTimeline] = useState<ForecastPoint[] | null>(null)

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

      {/* What-If Scenarios — only render if there are default or the section should always be visible */}
      <div className="card mb-6">
        <h2 className="mb-4 text-base font-semibold text-fjord">What-If Scenarios</h2>
        <ForecastScenarios
          scenarios={scenarios}
          onScenarioSelect={(scenario) => {
            setActiveScenarioTimeline(scenario.scenarioTimeline || null)
          }}
          onScenarioClear={() => {
            setActiveScenarioTimeline(null)
          }}
          baselineProjectedDate={baselineProjectedDate}
        />
      </div>
    </>
  )
}
