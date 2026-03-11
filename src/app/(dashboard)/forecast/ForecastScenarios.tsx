'use client'

import { useState } from 'react'
import type { ForecastScenario } from '@/types'
import { trackScenarioCustomized } from '@/lib/analytics'
import MonthlyBreakdownTable from '@/components/forecast/MonthlyBreakdownTable'

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

interface Props {
  scenarios: ForecastScenario[]
  customScenarios: ForecastScenario[]
  activeScenarioIds: string[]
  onScenarioToggle: (scenarioId: string) => void
  onCustomScenarioAdd: (scenario: ForecastScenario) => void
  onCustomScenarioRemove: (id: string) => void
  onScenarioDismiss: (id: string) => void
  baselineProjectedDate?: string | null
  debts?: DebtSummary[]
}

const SCENARIO_TYPES: { value: string; label: string; fields: string[] }[] = [
  { value: 'cut_spending', label: 'Cut spending', fields: ['percentage'] },
  { value: 'extra_debt_payment', label: 'Extra debt payment', fields: ['amount'] },
  { value: 'income_change', label: 'Income change', fields: ['amount'] },
  { value: 'savings_boost', label: 'Monthly savings boost', fields: ['amount'] },
  { value: 'lump_sum_payment', label: 'Lump sum debt payment', fields: ['amount'] },
  { value: 'new_expense', label: 'New monthly expense', fields: ['amount'] },
  { value: 'new_debt', label: 'Take on new debt', fields: ['principal', 'rate', 'term'] },
  { value: 'refinance', label: 'Refinance a debt', fields: ['rate', 'term'] },
  { value: 'property_value_change', label: 'Property value change', fields: ['newValue'] },
]

type ScenarioTypeValue = 'new_expense' | 'new_debt' | 'income_change' | 'extra_debt_payment' | 'property_value_change' | 'lump_sum_payment' | 'cut_spending' | 'savings_boost' | 'refinance'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatGoalDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function humanizeScenarioLabel(label: string): string {
  return label
    .replace(/^Custom\s+/, '')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
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

export default function ForecastScenarios({
  scenarios,
  customScenarios,
  activeScenarioIds,
  onScenarioToggle,
  onCustomScenarioAdd,
  onCustomScenarioRemove,
  onScenarioDismiss,
  baselineProjectedDate,
  debts = [],
}: Props) {
  const [expandedBreakdownId, setExpandedBreakdownId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [customType, setCustomType] = useState<ScenarioTypeValue>('new_expense')
  const [customLabel, setCustomLabel] = useState('')
  const [customAmount, setCustomAmount] = useState('')
  const [customPrincipal, setCustomPrincipal] = useState('')
  const [customRate, setCustomRate] = useState('5')
  const [customTerm, setCustomTerm] = useState('60')
  const [customNewValue, setCustomNewValue] = useState('')
  const [customPercentage, setCustomPercentage] = useState('10')
  const [customDebtId, setCustomDebtId] = useState('')
  const [customDelayMonths, setCustomDelayMonths] = useState('0')
  const [loading, setLoading] = useState(false)

  const allScenarios = [...scenarios, ...customScenarios]
  const customIds = new Set(customScenarios.map(s => s.id))

  function handleToggle(scenarioId: string) {
    if (!activeScenarioIds.includes(scenarioId) && activeScenarioIds.length >= 4) {
      // Could show a toast here, but for now just don't add
      return
    }
    onScenarioToggle(scenarioId)
  }

  async function handleCreateScenario() {
    setLoading(true)
    try {
      const params: Record<string, unknown> = {
        label: customLabel || `Custom ${SCENARIO_TYPES.find((t) => t.value === customType)?.label ?? 'scenario'}`,
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
      } else if (customType === 'extra_debt_payment') {
        params.amount = parseFloat(customAmount)
        if (customDebtId) params.debtId = customDebtId
        const targetDebt = debts.find(d => d.id === customDebtId)
        params.description = targetDebt
          ? `Add ${formatCurrency(parseFloat(customAmount))}/mo extra toward ${targetDebt.name}`
          : `Add ${formatCurrency(parseFloat(customAmount))}/mo extra toward highest-rate debt`
      } else if (customType === 'property_value_change') {
        params.newValue = parseFloat(customNewValue)
        params.description = `Set property value to ${formatCurrency(parseFloat(customNewValue))}`
      } else if (customType === 'lump_sum_payment') {
        params.amount = parseFloat(customAmount)
        if (customDebtId) params.debtId = customDebtId
        const targetDebt = debts.find(d => d.id === customDebtId)
        params.description = targetDebt
          ? `One-time ${formatCurrency(parseFloat(customAmount))} payment toward ${targetDebt.name}`
          : `One-time ${formatCurrency(parseFloat(customAmount))} payment toward debt`
      } else if (customType === 'cut_spending') {
        params.percentage = parseFloat(customPercentage)
        params.description = `Reduce flexible spending by ${customPercentage}%`
      } else if (customType === 'savings_boost') {
        params.amount = parseFloat(customAmount)
        params.description = `Save an extra ${formatCurrency(parseFloat(customAmount))}/mo`
      } else if (customType === 'refinance') {
        params.rate = parseFloat(customRate) / 100
        params.term = parseInt(customTerm)
        if (customDebtId) params.debtId = customDebtId
        const targetDebt = debts.find(d => d.id === customDebtId)
        const debtLabel = targetDebt?.propertyGroupName ?? targetDebt?.name
        params.description = debtLabel
          ? `Refinance ${debtLabel} to ${customRate}% for ${customTerm} months`
          : `Refinance to ${customRate}% for ${customTerm} months`
      }

      const delay = parseInt(customDelayMonths)
      if (delay > 0) {
        params.delayMonths = delay
        params.description = `${params.description} (starts in ${delay} month${delay !== 1 ? 's' : ''})`
      }

      const res = await fetch('/api/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioType: customType, params }),
      })

      if (res.ok) {
        const data = await res.json()
        onCustomScenarioAdd(data.scenario)
        trackScenarioCustomized(customType, customLabel || customType)
        setShowForm(false)
        setCustomLabel('')
        setCustomAmount('')
        setCustomPrincipal('')
        setCustomNewValue('')
        setCustomDebtId('')
        setCustomDelayMonths('0')
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
      <div className="space-y-3">
        {allScenarios.map((scenario) => {
          const { impact } = scenario
          const isActive = activeScenarioIds.includes(scenario.id)
          const isBreakdownExpanded = expandedBreakdownId === scenario.id
          const isCustom = customIds.has(scenario.id)

          const monthlyImpact = impact.monthlyImpactOnTrueRemaining
          const monthsSaved = impact.daysSaved !== 0 ? Math.round(impact.daysSaved / 30) : 0
          const cumulativeImpact = scenario.monthlyBreakdown?.length
            ? scenario.monthlyBreakdown[scenario.monthlyBreakdown.length - 1].cumulativeImpact
            : 0

          return (
            <div key={scenario.id}>
              <div
                className={`rounded-card p-4 transition-all ${
                  isActive
                    ? 'border-2 border-pine/50 bg-frost/50 ring-1 ring-pine/20'
                    : 'border border-mist bg-frost/30'
                }`}
              >
                {/* Header */}
                <div className="flex items-start gap-3">
                  <ScenarioTypeIcon type={scenario.type} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-fjord">{humanizeScenarioLabel(scenario.label)}</p>
                      <div className="flex items-center gap-1.5">
                        {(scenario as ForecastScenario & { recommended?: boolean }).recommended && (
                          <span className="rounded-badge bg-pine/20 px-2 py-0.5 text-[10px] font-medium text-pine">
                            Recommended
                          </span>
                        )}
                        {isActive && (
                          <span className="rounded-badge bg-pine/10 px-2 py-0.5 text-[10px] font-medium text-pine">
                            Active
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Narrative summary */}
                    {scenario.narrativeSummary && (
                      <p className="mt-1.5 text-sm leading-relaxed text-fjord">
                        {scenario.narrativeSummary}
                      </p>
                    )}
                    {!scenario.narrativeSummary && scenario.description && (
                      <p className="mt-0.5 text-xs text-stone">{scenario.description}</p>
                    )}

                    {/* Makes goal achievable badge */}
                    {impact.makesGoalAchievable && (
                      <span className="mt-1.5 inline-block rounded-badge bg-pine/20 px-2 py-0.5 text-[10px] font-medium text-pine">
                        Makes goal achievable
                      </span>
                    )}
                    {/* Delayed scenario badge */}
                    {(() => {
                      const delay = (scenario as ForecastScenario & { delayMonths?: number }).delayMonths
                      return delay != null && delay > 0 ? (
                        <span className="mt-1.5 ml-1 inline-block rounded-badge bg-birch/20 px-2 py-0.5 text-[10px] font-medium text-midnight">
                          Starts in {delay} month{delay !== 1 ? 's' : ''}
                        </span>
                      ) : null
                    })()}

                    {/* Primary: Goal date shift */}
                    <div className="mt-3">
                      {monthsSaved !== 0 ? (
                        <p className={`text-sm font-semibold ${monthsSaved > 0 ? 'text-pine' : 'text-ember'}`}>
                          Goal reached {Math.abs(monthsSaved)} month{Math.abs(monthsSaved) !== 1 ? 's' : ''} {monthsSaved > 0 ? 'earlier' : 'later'}
                          {scenario.baselineProjectedDate && scenario.scenarioProjectedDate && (
                            <span className="font-normal text-stone">
                              {' '}({formatGoalDate(scenario.scenarioProjectedDate)} {monthsSaved > 0 ? 'instead of' : 'vs'} {formatGoalDate(scenario.baselineProjectedDate)})
                            </span>
                          )}
                        </p>
                      ) : (
                        <p className="text-sm text-stone">No change to goal timeline</p>
                      )}
                    </div>

                    {/* Secondary stats */}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone">
                      {monthlyImpact !== 0 && (
                        <span>
                          <span className={monthlyImpact >= 0 ? 'text-pine' : 'text-ember'}>
                            {monthlyImpact >= 0 ? '+' : ''}{formatCurrency(monthlyImpact)}/mo
                          </span>
                          {' '}to True Remaining
                        </span>
                      )}
                      {cumulativeImpact !== 0 && scenario.monthlyBreakdown && (
                        <span>
                          Total impact: <span className={cumulativeImpact >= 0 ? 'text-pine' : 'text-ember'}>
                            {cumulativeImpact >= 0 ? '+' : ''}{formatCurrency(Math.abs(cumulativeImpact))}
                          </span>
                          {' '}over {scenario.monthlyBreakdown.length} months
                        </span>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {scenario.scenarioTimeline && (
                        <button
                          onClick={() => handleToggle(scenario.id)}
                          className={`text-xs font-medium transition-colors ${
                            isActive ? 'text-pine' : 'text-fjord hover:text-pine'
                          }`}
                        >
                          {isActive ? 'On chart \u2713' : 'Add to chart'}
                        </button>
                      )}

                      {scenario.monthlyBreakdown && scenario.monthlyBreakdown.length > 0 && (
                        <button
                          onClick={() => setExpandedBreakdownId(isBreakdownExpanded ? null : scenario.id)}
                          className="text-xs font-medium text-fjord transition-colors hover:text-pine"
                        >
                          {isBreakdownExpanded ? 'Hide breakdown \u25B2' : 'View breakdown \u25BC'}
                        </button>
                      )}

                      {isCustom ? (
                        <button
                          onClick={() => onCustomScenarioRemove(scenario.id)}
                          className="text-xs text-stone transition-colors hover:text-ember"
                        >
                          Delete
                        </button>
                      ) : (
                        <button
                          onClick={() => onScenarioDismiss(scenario.id)}
                          className="text-xs text-stone transition-colors hover:text-ember"
                        >
                          Dismiss
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded breakdown table */}
              {isBreakdownExpanded && scenario.monthlyBreakdown && (
                <div className="mt-1 rounded-b-card border border-t-0 border-mist bg-snow p-4">
                  <MonthlyBreakdownTable
                    breakdown={scenario.monthlyBreakdown}
                    baselineGoalDate={scenario.baselineProjectedDate ?? baselineProjectedDate ?? null}
                    scenarioGoalDate={scenario.scenarioProjectedDate ?? null}
                  />
                </div>
              )}
            </div>
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
            <p className="mb-3 text-sm font-semibold text-fjord">Custom scenario</p>

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

              {selectedType?.fields.includes('newValue') && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-stone">New property value ($)</label>
                  <input
                    type="number"
                    value={customNewValue}
                    onChange={(e) => setCustomNewValue(e.target.value)}
                    placeholder="0"
                    step="1000"
                    className="input w-full text-sm"
                  />
                </div>
              )}

              {selectedType?.fields.includes('percentage') && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-stone">Cut percentage (%)</label>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    step="5"
                    value={customPercentage}
                    onChange={(e) => setCustomPercentage(e.target.value)}
                    className="w-full accent-pine"
                  />
                  <div className="mt-1 text-center text-sm font-medium text-fjord">{customPercentage}%</div>
                </div>
              )}

              {/* Debt selector for debt-linked scenario types */}
              {(customType === 'refinance' || customType === 'lump_sum_payment' || customType === 'extra_debt_payment') && debts.length > 0 && (() => {
                const filteredDebts = customType === 'refinance'
                  ? debts.filter(d => d.type === 'MORTGAGE')
                  : debts

                // For refinance, group debts by property group so a single mortgage
                // on a multi-unit property shows as one entry (e.g. "123 Main St")
                type DropdownOption = { key: string; value: string; label: string }
                const dropdownOptions: DropdownOption[] = []

                if (customType === 'refinance') {
                  const grouped = new Map<string, DebtSummary[]>()
                  const ungrouped: DebtSummary[] = []

                  for (const d of filteredDebts) {
                    if (d.propertyGroupId) {
                      const existing = grouped.get(d.propertyGroupId) ?? []
                      existing.push(d)
                      grouped.set(d.propertyGroupId, existing)
                    } else {
                      ungrouped.push(d)
                    }
                  }

                  // Add grouped entries (combined balance, weighted avg rate)
                  for (const [groupId, groupDebts] of grouped) {
                    const combinedBalance = groupDebts.reduce((s, d) => s + d.currentBalance, 0)
                    const combinedPayment = groupDebts.reduce((s, d) => s + d.minimumPayment, 0)
                    const weightedRate = combinedBalance > 0
                      ? groupDebts.reduce((s, d) => s + d.interestRate * d.currentBalance, 0) / combinedBalance
                      : 0
                    const groupName = groupDebts[0].propertyGroupName ?? 'Property Group'
                    // Use first debt ID as the value — the API applies to this debt,
                    // but the display shows the combined group info
                    dropdownOptions.push({
                      key: `group-${groupId}`,
                      value: groupDebts[0].id,
                      label: `${groupName} — ${formatCurrency(combinedBalance)} at ${(weightedRate * 100).toFixed(1)}%${combinedPayment > 0 ? ` (${formatCurrency(combinedPayment)}/mo)` : ''}`,
                    })
                  }

                  // Add ungrouped debts individually
                  for (const d of ungrouped) {
                    dropdownOptions.push({
                      key: d.id,
                      value: d.id,
                      label: `${d.name} — ${formatCurrency(d.currentBalance)} at ${(d.interestRate * 100).toFixed(1)}%${d.minimumPayment > 0 ? ` (${formatCurrency(d.minimumPayment)}/mo)` : ''}`,
                    })
                  }
                } else {
                  for (const d of filteredDebts) {
                    dropdownOptions.push({
                      key: d.id,
                      value: d.id,
                      label: `${d.name} — ${formatCurrency(d.currentBalance)} at ${(d.interestRate * 100).toFixed(1)}%${d.minimumPayment > 0 ? ` (${formatCurrency(d.minimumPayment)}/mo)` : ''}`,
                    })
                  }
                }

                return (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-stone">
                      {customType === 'refinance' ? 'Select mortgage' : 'Select debt'}
                    </label>
                    <select
                      value={customDebtId}
                      onChange={(e) => setCustomDebtId(e.target.value)}
                      className="input w-full text-sm"
                    >
                      <option value="">
                        {customType === 'refinance'
                          ? 'Highest-rate mortgage'
                          : 'Highest-rate debt'}
                      </option>
                      {dropdownOptions.map(opt => (
                        <option key={opt.key} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {filteredDebts.length === 0 && customType === 'refinance' && (
                      <p className="mt-1 text-[10px] text-ember">No mortgages found. Add a mortgage debt first.</p>
                    )}
                  </div>
                )
              })()}

              {/* Rate/term fields for refinance (no principal needed) */}
              {customType === 'refinance' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-stone">New rate (%)</label>
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
                    <label className="mb-1 block text-xs font-medium text-stone">New term (months)</label>
                    <input
                      type="number"
                      value={customTerm}
                      onChange={(e) => setCustomTerm(e.target.value)}
                      placeholder="360"
                      step="1"
                      className="input w-full text-sm"
                    />
                  </div>
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

              {/* When does this start? (delay) */}
              <div>
                <label className="mb-1 block text-xs font-medium text-stone">When does this start?</label>
                <select
                  value={customDelayMonths}
                  onChange={(e) => setCustomDelayMonths(e.target.value)}
                  className="input w-full text-sm"
                >
                  <option value="0">Immediately</option>
                  <option value="1">In 1 month</option>
                  <option value="2">In 2 months</option>
                  <option value="3">In 3 months</option>
                  <option value="6">In 6 months</option>
                  <option value="12">In 1 year</option>
                  <option value="24">In 2 years</option>
                </select>
              </div>

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

      {/* Link to debts page when debts exist */}
      {debts.length > 0 && (
        <div className="mt-3 text-center">
          <a href="/debts" className="text-xs font-medium text-fjord hover:text-pine transition-colors">
            View debt details &rarr;
          </a>
        </div>
      )}
    </div>
  )
}
