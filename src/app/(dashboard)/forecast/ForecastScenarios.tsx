'use client'

import { useState } from 'react'
import type { ForecastScenario } from '@/types'

interface Props {
  scenarios: ForecastScenario[]
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}

function ScenarioTypeIcon({ type }: { type: ForecastScenario['type'] }) {
  const icons: Record<ForecastScenario['type'], string> = {
    expense: '💸',
    debt: '🏦',
    income: '💰',
    refinance: '🔄',
    investment: '📈',
    cut: '✂️',
  }
  return <span className="text-lg">{icons[type] ?? '📊'}</span>
}

export default function ForecastScenarios({ scenarios }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {scenarios.map((scenario) => {
        const isExpanded = expandedId === scenario.id
        const { impact } = scenario
        const isPositive = impact.daysSaved > 0 || impact.monthlyImpactOnGoal > 0

        return (
          <button
            key={scenario.id}
            onClick={() => setExpandedId(isExpanded ? null : scenario.id)}
            className="rounded-card border border-mist bg-frost/30 p-4 text-left transition-colors hover:bg-frost/60"
          >
            <div className="flex items-start gap-3">
              <ScenarioTypeIcon type={scenario.type} />
              <div className="flex-1">
                <p className="text-sm font-semibold text-fjord">{scenario.label}</p>
                <p className="mt-0.5 text-xs text-stone">{scenario.description}</p>

                {isExpanded && (
                  <div className="mt-3 space-y-2 border-t border-mist pt-3">
                    {impact.daysSaved !== 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-stone">Goal date impact</span>
                        <span className={`font-medium ${impact.daysSaved > 0 ? 'text-pine' : 'text-ember'}`}>
                          {impact.daysSaved > 0 ? '−' : '+'}{Math.abs(impact.daysSaved)} days
                        </span>
                      </div>
                    )}
                    {impact.monthlyImpactOnTrueRemaining !== 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-stone">True Remaining</span>
                        <span className={`font-medium ${impact.monthlyImpactOnTrueRemaining >= 0 ? 'text-pine' : 'text-ember'}`}>
                          {impact.monthlyImpactOnTrueRemaining >= 0 ? '+' : ''}{formatCurrency(impact.monthlyImpactOnTrueRemaining)}/mo
                        </span>
                      </div>
                    )}
                    {impact.totalInterestImpact != null && impact.totalInterestImpact !== 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-stone">Interest impact</span>
                        <span className={`font-medium ${impact.totalInterestImpact <= 0 ? 'text-pine' : 'text-ember'}`}>
                          {impact.totalInterestImpact <= 0 ? '−' : '+'}{formatCurrency(Math.abs(impact.totalInterestImpact))}
                        </span>
                      </div>
                    )}
                    {impact.newMonthlyPayment != null && (
                      <div className="flex justify-between text-xs">
                        <span className="text-stone">Monthly payment</span>
                        <span className="font-medium text-fjord">{formatCurrency(impact.newMonthlyPayment)}</span>
                      </div>
                    )}
                  </div>
                )}

                {!isExpanded && (
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className={`rounded-badge px-1.5 py-0.5 text-xs font-medium ${
                        isPositive ? 'bg-pine/10 text-pine' : 'bg-ember/10 text-ember'
                      }`}
                    >
                      {impact.daysSaved > 0
                        ? `${impact.daysSaved} days sooner`
                        : impact.daysSaved < 0
                          ? `${Math.abs(impact.daysSaved)} days later`
                          : impact.monthlyImpactOnGoal > 0
                            ? `+${formatCurrency(impact.monthlyImpactOnGoal)}/mo`
                            : impact.monthlyImpactOnGoal < 0
                              ? `${formatCurrency(impact.monthlyImpactOnGoal)}/mo`
                              : 'No date impact'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
