'use client'

import { useState } from 'react'
import type { ForecastScenario } from '@/types'
import { trackScenarioCustomized } from '@/lib/analytics'

interface Props {
  scenarios: ForecastScenario[]
}

const SCENARIO_TYPES: { value: string; label: string; fields: string[] }[] = [
  { value: 'new_expense', label: 'New monthly expense', fields: ['amount'] },
  { value: 'new_debt', label: 'Take on new debt', fields: ['principal', 'rate', 'term'] },
  { value: 'income_change', label: 'Income change', fields: ['amount'] },
]

type ScenarioTypeValue = 'new_expense' | 'new_debt' | 'income_change'

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
  const [showForm, setShowForm] = useState(false)
  const [customType, setCustomType] = useState<ScenarioTypeValue>('new_expense')
  const [customLabel, setCustomLabel] = useState('')
  const [customAmount, setCustomAmount] = useState('')
  const [customPrincipal, setCustomPrincipal] = useState('')
  const [customRate, setCustomRate] = useState('5')
  const [customTerm, setCustomTerm] = useState('60')
  const [loading, setLoading] = useState(false)
  const [customScenarios, setCustomScenarios] = useState<ForecastScenario[]>([])

  const allScenarios = [...scenarios, ...customScenarios]

  async function handleCreateScenario() {
    setLoading(true)
    try {
      const params: Record<string, unknown> = {
        label: customLabel || `Custom ${customType}`,
        description: '',
      }

      if (customType === 'new_expense') {
        params.amount = parseFloat(customAmount)
        params.description = `Add ${formatCurrency(parseFloat(customAmount))}/mo expense`
      } else if (customType === 'new_debt') {
        params.principal = parseFloat(customPrincipal)
        params.rate = parseFloat(customRate) / 100
        params.term = parseInt(customTerm)
        params.name = customLabel || 'New Debt'
        params.description = `${formatCurrency(parseFloat(customPrincipal))} at ${customRate}% for ${customTerm} months`
      } else if (customType === 'income_change') {
        params.amount = parseFloat(customAmount)
        params.description = `${parseFloat(customAmount) >= 0 ? 'Increase' : 'Decrease'} income by ${formatCurrency(Math.abs(parseFloat(customAmount)))}/mo`
      }

      const res = await fetch('/api/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioType: customType, params }),
      })

      if (res.ok) {
        const data = await res.json()
        setCustomScenarios((prev) => [...prev, data.scenario])
        trackScenarioCustomized(customType, customLabel || customType)
        setShowForm(false)
        setCustomLabel('')
        setCustomAmount('')
        setCustomPrincipal('')
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  const selectedType = SCENARIO_TYPES.find((t) => t.value === customType)

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {allScenarios.map((scenario) => {
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

      {/* Custom scenario creation */}
      <div className="mt-4">
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="w-full rounded-card border-2 border-dashed border-mist p-4 text-center text-sm text-stone transition-colors hover:border-fjord/30 hover:text-fjord"
          >
            + Create custom scenario
          </button>
        ) : (
          <div className="rounded-card border border-mist bg-frost/50 p-4">
            <p className="mb-3 text-sm font-semibold text-fjord">Custom Scenario</p>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-stone">Scenario type</label>
                <select
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value as ScenarioTypeValue)}
                  className="input w-full text-sm"
                >
                  {SCENARIO_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-stone">Label</label>
                <input
                  type="text"
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="e.g. New gym membership"
                  className="input w-full text-sm"
                />
              </div>

              {selectedType?.fields.includes('amount') && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-stone">
                    {customType === 'income_change' ? 'Monthly amount change ($)' : 'Monthly amount ($)'}
                  </label>
                  <input
                    type="number"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder="0"
                    step="1"
                    className="input w-full text-sm"
                  />
                  {customType === 'income_change' && (
                    <p className="mt-1 text-[10px] text-stone">Positive = income increase, negative = decrease</p>
                  )}
                </div>
              )}

              {selectedType?.fields.includes('principal') && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-stone">Loan amount ($)</label>
                    <input
                      type="number"
                      value={customPrincipal}
                      onChange={(e) => setCustomPrincipal(e.target.value)}
                      placeholder="0"
                      step="100"
                      className="input w-full text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-stone">Interest rate (%)</label>
                      <input
                        type="number"
                        value={customRate}
                        onChange={(e) => setCustomRate(e.target.value)}
                        placeholder="5"
                        step="0.1"
                        className="input w-full text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-stone">Term (months)</label>
                      <input
                        type="number"
                        value={customTerm}
                        onChange={(e) => setCustomTerm(e.target.value)}
                        placeholder="60"
                        step="1"
                        className="input w-full text-sm"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleCreateScenario}
                  disabled={loading}
                  className="btn-primary px-4 py-1.5 text-sm disabled:opacity-50"
                >
                  {loading ? 'Computing...' : 'Run scenario'}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="btn-secondary px-4 py-1.5 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
