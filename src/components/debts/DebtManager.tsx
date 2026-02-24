'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'

interface DebtRow {
  id: string
  name: string
  type: string
  currentBalance: number
  originalBalance: number | null
  interestRate: number
  minimumPayment: number
  escrowAmount: number | null
  paymentDay: number | null
  termMonths: number | null
  startDate: string | null
  propertyId: string | null
  categoryId: string | null
  property: { id: string; name: string } | null
  category: { id: string; name: string } | null
  monthlyInterest: number
  monthlyPrincipal: number
  monthsRemaining: number | null
}

interface PropertyOption {
  id: string
  name: string
  type: string
}

interface CategoryOption {
  id: string
  name: string
  group: string
}

const DEBT_TYPES = [
  { value: 'MORTGAGE', label: 'Mortgage' },
  { value: 'STUDENT_LOAN', label: 'Student Loan' },
  { value: 'AUTO', label: 'Auto Loan' },
  { value: 'CREDIT_CARD', label: 'Credit Card' },
  { value: 'PERSONAL_LOAN', label: 'Personal Loan' },
  { value: 'OTHER', label: 'Other' },
]

function debtTypeLabel(type: string): string {
  return DEBT_TYPES.find(t => t.value === type)?.label ?? type
}

interface Props {
  debts: DebtRow[]
  properties: PropertyOption[]
  categories: CategoryOption[]
}

export default function DebtManager({ debts: initial, properties, categories }: Props) {
  const router = useRouter()
  const [debts, setDebts] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState('MORTGAGE')
  const [formBalance, setFormBalance] = useState('')
  const [formOriginalBalance, setFormOriginalBalance] = useState('')
  const [formRate, setFormRate] = useState('')
  const [formPayment, setFormPayment] = useState('')
  const [formEscrowAmount, setFormEscrowAmount] = useState('')
  const [formPaymentDay, setFormPaymentDay] = useState('')
  const [formTermMonths, setFormTermMonths] = useState('')
  const [formPropertyId, setFormPropertyId] = useState('')
  const [formCategoryId, setFormCategoryId] = useState('')

  function resetForm() {
    setFormName('')
    setFormType('MORTGAGE')
    setFormBalance('')
    setFormOriginalBalance('')
    setFormRate('')
    setFormPayment('')
    setFormEscrowAmount('')
    setFormPaymentDay('')
    setFormTermMonths('')
    setFormPropertyId('')
    setFormCategoryId('')
    setError(null)
  }

  async function handleCreate() {
    if (saving) return

    const name = formName.trim()
    if (!name) { setError('Name is required.'); return }
    const currentBalance = parseFloat(formBalance)
    if (isNaN(currentBalance) || currentBalance < 0) { setError('Balance must be a valid number.'); return }
    const interestRate = parseFloat(formRate) / 100
    if (isNaN(interestRate) || interestRate < 0) { setError('Interest rate must be a valid percentage.'); return }
    const minimumPayment = parseFloat(formPayment)
    if (isNaN(minimumPayment) || minimumPayment < 0) { setError('Payment must be a valid number.'); return }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/debts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          type: formType,
          currentBalance,
          originalBalance: formOriginalBalance ? parseFloat(formOriginalBalance) : null,
          interestRate,
          minimumPayment,
          escrowAmount: formEscrowAmount ? parseFloat(formEscrowAmount) : null,
          paymentDay: formPaymentDay ? parseInt(formPaymentDay, 10) : null,
          termMonths: formTermMonths ? parseInt(formTermMonths, 10) : null,
          propertyId: formPropertyId || null,
          categoryId: formCategoryId || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to create debt')
      }
      resetForm()
      setShowForm(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create debt')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    const prev = debts
    setDebts(d => d.filter(debt => debt.id !== id))

    try {
      const res = await fetch(`/api/debts/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      router.refresh()
    } catch {
      setDebts(prev)
      setError('Failed to delete debt')
    }
  }

  // Group categories for dropdown
  const groupedCategories = categories.reduce<Record<string, CategoryOption[]>>((acc, cat) => {
    const g = cat.group || 'Other'
    if (!acc[g]) acc[g] = []
    acc[g].push(cat)
    return acc
  }, {})

  return (
    <div>
      {debts.length === 0 && !showForm ? (
        <div className="card text-center py-12">
          <p className="mb-1 text-sm font-medium text-stone">No debts tracked yet</p>
          <p className="mb-4 text-xs text-stone">Add your debts to track principal vs interest and payoff progress.</p>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            + Add debt
          </button>
        </div>
      ) : (
        <>
          {/* Debt cards */}
          <div className="space-y-4">
            {debts.map((debt) => (
              <div key={debt.id} className="card">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-fjord">{debt.name}</h3>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="rounded-badge bg-fjord/10 px-2 py-0.5 text-xs font-medium text-fjord">
                        {debtTypeLabel(debt.type)}
                      </span>
                      {debt.property && (
                        <span className="text-xs text-stone">{debt.property.name}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(debt.id)}
                    className="text-xs text-stone hover:text-ember"
                  >
                    Delete
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-stone">Balance</p>
                    <p className="text-lg font-bold text-fjord">{formatCurrency(debt.currentBalance)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-stone">Rate</p>
                    <p className="text-lg font-bold text-fjord">{(debt.interestRate * 100).toFixed(2)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-stone">
                      {debt.escrowAmount ? 'Total Monthly' : 'Payment'}
                    </p>
                    <p className="text-lg font-bold text-fjord">
                      {formatCurrency(debt.minimumPayment + (debt.escrowAmount ?? 0))}/mo
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-stone">Est. Remaining</p>
                    <p className="text-lg font-bold text-fjord">
                      {debt.monthsRemaining !== null
                        ? `${Math.floor(debt.monthsRemaining / 12)}y ${debt.monthsRemaining % 12}m`
                        : '—'}
                    </p>
                  </div>
                </div>

                {/* P&I breakdown */}
                <div className="mt-4 rounded-lg border border-mist bg-snow p-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-stone">
                    Monthly Payment Breakdown
                  </p>
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-pine" />
                      <span className="text-stone">Principal:</span>
                      <span className="font-semibold text-fjord">{formatCurrency(debt.monthlyPrincipal)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-ember" />
                      <span className="text-stone">Interest:</span>
                      <span className="font-semibold text-fjord">{formatCurrency(debt.monthlyInterest)}</span>
                    </div>
                    {debt.escrowAmount != null && debt.escrowAmount > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-stone" />
                        <span className="text-stone">Escrow:</span>
                        <span className="font-semibold text-fjord">{formatCurrency(debt.escrowAmount)}</span>
                      </div>
                    )}
                  </div>
                  {/* P&I (+Escrow) bar */}
                  {debt.minimumPayment > 0 && (() => {
                    const totalBar = debt.minimumPayment + (debt.escrowAmount ?? 0)
                    return (
                      <div className="mt-2 flex h-2 overflow-hidden rounded-bar">
                        <div
                          className="bg-pine"
                          style={{ width: `${(debt.monthlyPrincipal / totalBar) * 100}%` }}
                        />
                        <div
                          className="bg-ember"
                          style={{ width: `${(debt.monthlyInterest / totalBar) * 100}%` }}
                        />
                        {debt.escrowAmount != null && debt.escrowAmount > 0 && (
                          <div
                            className="bg-stone"
                            style={{ width: `${(debt.escrowAmount / totalBar) * 100}%` }}
                          />
                        )}
                      </div>
                    )
                  })()}
                </div>

                {/* Progress bar for original → current */}
                {debt.originalBalance && debt.originalBalance > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-stone">
                      <span>Payoff progress</span>
                      <span>
                        {(((debt.originalBalance - debt.currentBalance) / debt.originalBalance) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-bar bg-mist">
                      <div
                        className="h-full rounded-bar bg-pine"
                        style={{
                          width: `${((debt.originalBalance - debt.currentBalance) / debt.originalBalance) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add debt button */}
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="btn-primary mt-4"
            >
              + Add debt
            </button>
          )}
        </>
      )}

      {/* Add debt form */}
      {showForm && (
        <div className="card mt-4">
          <h2 className="mb-4 text-lg font-semibold text-fjord">Add Debt</h2>
          {error && (
            <p className="mb-4 rounded-lg bg-ember/10 p-3 text-sm text-ember">{error}</p>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-fjord">Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="input"
                  placeholder="e.g. Mortgage - 123 Main St"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-fjord">Type</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="input"
                >
                  {DEBT_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-fjord">Current Balance</label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-stone">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formBalance}
                    onChange={(e) => setFormBalance(e.target.value)}
                    className="input pl-7"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-fjord">Interest Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formRate}
                  onChange={(e) => setFormRate(e.target.value)}
                  className="input"
                  placeholder="5.30"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-fjord">Monthly Payment</label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-stone">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formPayment}
                    onChange={(e) => setFormPayment(e.target.value)}
                    className="input pl-7"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {formType === 'MORTGAGE' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-fjord">
                  Monthly Escrow (taxes &amp; insurance) <span className="font-normal text-stone">(optional)</span>
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-stone">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formEscrowAmount}
                    onChange={(e) => setFormEscrowAmount(e.target.value)}
                    className="input pl-7"
                    placeholder="0.00"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-fjord">
                  Original Balance <span className="font-normal text-stone">(optional)</span>
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-stone">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formOriginalBalance}
                    onChange={(e) => setFormOriginalBalance(e.target.value)}
                    className="input pl-7"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-fjord">
                  Payment Day <span className="font-normal text-stone">(optional)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={formPaymentDay}
                  onChange={(e) => setFormPaymentDay(e.target.value)}
                  className="input"
                  placeholder="15"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-fjord">
                  Term (months) <span className="font-normal text-stone">(optional)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={formTermMonths}
                  onChange={(e) => setFormTermMonths(e.target.value)}
                  className="input"
                  placeholder="360"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {properties.length > 0 && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-fjord">
                    Property <span className="font-normal text-stone">(optional)</span>
                  </label>
                  <select
                    value={formPropertyId}
                    onChange={(e) => setFormPropertyId(e.target.value)}
                    className="input"
                  >
                    <option value="">No property</option>
                    {properties.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-fjord">
                  Category <span className="font-normal text-stone">(optional)</span>
                </label>
                <select
                  value={formCategoryId}
                  onChange={(e) => setFormCategoryId(e.target.value)}
                  className="input"
                >
                  <option value="">No category</option>
                  {Object.entries(groupedCategories).map(([group, cats]) => (
                    <optgroup key={group} label={group}>
                      {cats.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="mt-5 flex gap-3">
            <button
              onClick={handleCreate}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? 'Saving...' : 'Add Debt'}
            </button>
            <button
              onClick={() => { setShowForm(false); resetForm() }}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
