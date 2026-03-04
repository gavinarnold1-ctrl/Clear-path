'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { amortizationSchedule, effectiveRate as calcEffectiveRate } from '@/lib/engines/amortization'
import type { AmortizationRow } from '@/lib/engines/amortization'

interface PaymentRecord {
  id: string
  date: string
  merchant: string
  amount: number
}

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
  property: {
    id: string
    name: string
    taxSchedule?: string | null
    groupId?: string | null
    groupName?: string | null
    splitPct?: number | null
  } | null
  category: { id: string; name: string } | null
  monthlyInterest: number
  monthlyPrincipal: number
  monthsRemaining: number | null
  transactions?: PaymentRecord[]
}

interface PropertyOption {
  id: string
  name: string
  type: string
  taxSchedule?: string | null
  currentValue?: number | null
  loanBalance?: number | null
  monthlyPayment?: number | null
  interestRate?: number | null
  loanTermMonths?: number | null
  monthlyPropertyTax?: number | null
  monthlyInsurance?: number | null
  monthlyHOA?: number | null
  monthlyPMI?: number | null
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
  const [editingId, setEditingId] = useState<string | null>(null)
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
    setEditingId(null)
    setError(null)
  }

  function startEdit(debt: DebtRow) {
    setEditingId(debt.id)
    setShowForm(true)
    setFormName(debt.name)
    setFormType(debt.type)
    setFormBalance(String(debt.currentBalance))
    setFormOriginalBalance(debt.originalBalance != null ? String(debt.originalBalance) : '')
    setFormRate(String(debt.interestRate * 100))
    setFormPayment(String(debt.minimumPayment))
    setFormEscrowAmount(debt.escrowAmount != null ? String(debt.escrowAmount) : '')
    setFormPaymentDay(debt.paymentDay != null ? String(debt.paymentDay) : '')
    setFormTermMonths(debt.termMonths != null ? String(debt.termMonths) : '')
    setFormPropertyId(debt.propertyId ?? '')
    setFormCategoryId(debt.categoryId ?? '')
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
      // R5.7: Add the new debt to local state immediately so it appears without page refresh
      const newDebt = await res.json()
      setDebts(prev => [...prev, newDebt])
      resetForm()
      setShowForm(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create debt')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate() {
    if (saving || !editingId) return

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
      const res = await fetch(`/api/debts/${editingId}`, {
        method: 'PATCH',
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
        throw new Error(data.error ?? 'Failed to update debt')
      }
      const updated = await res.json()
      // Recompute P&I fields client-side for immediate display
      const piPayment = updated.minimumPayment - (updated.escrowAmount ?? 0)
      const monthlyRate = updated.interestRate / 12
      const monthlyInterest = updated.currentBalance * monthlyRate
      const monthlyPrincipal = Math.max(0, piPayment - monthlyInterest)

      // Use amortization formula for months remaining (not linear division)
      // n = -ln(1 - balance * r / P) / ln(1 + r)
      let monthsRemaining: number | null = null
      if (monthlyPrincipal > 0 && piPayment > monthlyInterest && updated.interestRate > 0) {
        const fraction = 1 - (updated.currentBalance * monthlyRate) / piPayment
        if (fraction > 0) {
          monthsRemaining = Math.ceil(-Math.log(fraction) / Math.log(1 + monthlyRate))
        }
      } else if (monthlyPrincipal > 0 && updated.interestRate === 0) {
        monthsRemaining = Math.ceil(updated.currentBalance / piPayment)
      }

      setDebts(prev => prev.map(d => d.id === editingId ? {
        ...d,
        name: updated.name,
        type: updated.type,
        currentBalance: updated.currentBalance,
        originalBalance: updated.originalBalance ?? null,
        interestRate: updated.interestRate,
        minimumPayment: updated.minimumPayment,
        escrowAmount: updated.escrowAmount ?? null,
        paymentDay: updated.paymentDay ?? null,
        termMonths: updated.termMonths ?? null,
        propertyId: updated.propertyId ?? null,
        categoryId: updated.categoryId ?? null,
        property: updated.property
          ? { id: updated.property.id, name: updated.property.name, taxSchedule: updated.property.taxSchedule ?? null }
          : null,
        category: updated.category ? { id: updated.category.id, name: updated.category.name } : null,
        monthlyInterest: Math.round(monthlyInterest * 100) / 100,
        monthlyPrincipal: Math.round(monthlyPrincipal * 100) / 100,
        monthsRemaining,
      } : d))
      resetForm()
      setShowForm(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update debt')
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
          {/* Debt cards — group by property group */}
          <div className="space-y-4">
            <DebtCardList
              debts={debts}
              properties={properties}
              onEdit={startEdit}
              onDelete={handleDelete}
            />
          </div>

          {/* Add debt button */}
          {!showForm && (
            <button
              onClick={() => { resetForm(); setShowForm(true) }}
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
          <h2 className="mb-4 text-lg font-semibold text-fjord">{editingId ? 'Edit Debt' : 'Add Debt'}</h2>
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
                <label className="mb-1 block text-sm font-medium text-fjord">Total Monthly Payment</label>
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
              onClick={editingId ? handleUpdate : handleCreate}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Debt'}
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

/**
 * Renders the debt list, grouping debts that share a PropertyGroup into
 * a single rolled-up card with click-to-expand per-unit breakdown.
 */
function DebtCardList({
  debts,
  properties,
  onEdit,
  onDelete,
}: {
  debts: DebtRow[]
  properties: PropertyOption[]
  onEdit: (debt: DebtRow) => void
  onDelete: (id: string) => void
}) {
  // Build grouped and ungrouped lists
  const groupMap = new Map<string, { groupName: string; debts: DebtRow[] }>()
  const ungrouped: DebtRow[] = []

  for (const debt of debts) {
    const groupId = debt.property?.groupId
    if (groupId && debt.property?.groupName) {
      const existing = groupMap.get(groupId)
      if (existing) {
        existing.debts.push(debt)
      } else {
        groupMap.set(groupId, { groupName: debt.property.groupName, debts: [debt] })
      }
    } else {
      ungrouped.push(debt)
    }
  }

  // Only roll up if there are 2+ debts in the group
  const groups = Array.from(groupMap.entries()).filter(([, g]) => g.debts.length >= 2)
  const singleGroupDebts = Array.from(groupMap.entries())
    .filter(([, g]) => g.debts.length < 2)
    .flatMap(([, g]) => g.debts)
  const standaloneDebts = [...ungrouped, ...singleGroupDebts]

  return (
    <>
      {/* Grouped debt cards */}
      {groups.map(([groupId, group]) => (
        <GroupedDebtCard
          key={groupId}
          groupName={group.groupName}
          debts={group.debts}
          properties={properties}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}

      {/* Ungrouped debt cards */}
      {standaloneDebts.map((debt) => (
        <SingleDebtCard
          key={debt.id}
          debt={debt}
          properties={properties}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </>
  )
}

/** Rolled-up card for debts in the same PropertyGroup */
function GroupedDebtCard({
  groupName,
  debts,
  properties,
  onEdit,
  onDelete,
}: {
  groupName: string
  debts: DebtRow[]
  properties: PropertyOption[]
  onEdit: (debt: DebtRow) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  // Combined totals
  const totalBalance = debts.reduce((s, d) => s + d.currentBalance, 0)
  const totalPayment = debts.reduce((s, d) => s + d.minimumPayment, 0)
  const totalInterest = debts.reduce((s, d) => s + d.monthlyInterest, 0)
  const totalPrincipal = debts.reduce((s, d) => s + d.monthlyPrincipal, 0)
  // Use weighted average for interest rate
  const avgRate = totalBalance > 0
    ? debts.reduce((s, d) => s + d.currentBalance * d.interestRate, 0) / totalBalance
    : 0
  // Use max of months remaining for the group
  const maxMonthsRemaining = debts.reduce<number | null>((max, d) => {
    if (d.monthsRemaining == null) return max
    if (max == null) return d.monthsRemaining
    return Math.max(max, d.monthsRemaining)
  }, null)

  // Combined PITI from all units' properties
  const combinedEscrow = debts.reduce((s, d) => {
    const prop = d.propertyId ? properties.find(p => p.id === d.propertyId) : null
    if (!prop) return s
    return s + (prop.monthlyPropertyTax ?? 0) + (prop.monthlyInsurance ?? 0) +
      (prop.monthlyHOA ?? 0) + (prop.monthlyPMI ?? 0)
  }, 0)
  const combinedTax = debts.reduce((s, d) => {
    const prop = d.propertyId ? properties.find(p => p.id === d.propertyId) : null
    return s + (prop?.monthlyPropertyTax ?? 0)
  }, 0)
  const combinedInsurance = debts.reduce((s, d) => {
    const prop = d.propertyId ? properties.find(p => p.id === d.propertyId) : null
    return s + (prop?.monthlyInsurance ?? 0)
  }, 0)
  const combinedHOA = debts.reduce((s, d) => {
    const prop = d.propertyId ? properties.find(p => p.id === d.propertyId) : null
    return s + (prop?.monthlyHOA ?? 0)
  }, 0)
  const combinedPMI = debts.reduce((s, d) => {
    const prop = d.propertyId ? properties.find(p => p.id === d.propertyId) : null
    return s + (prop?.monthlyPMI ?? 0)
  }, 0)
  const hasPiti = combinedTax > 0

  const escrowItems = hasPiti
    ? [
        { label: 'Property Tax', amount: combinedTax, color: 'bg-birch' },
        { label: 'Insurance', amount: combinedInsurance, color: 'bg-lichen' },
        ...(combinedHOA > 0 ? [{ label: 'HOA', amount: combinedHOA, color: 'bg-mist' }] : []),
        ...(combinedPMI > 0 ? [{ label: 'PMI', amount: combinedPMI, color: 'bg-stone/50' }] : []),
      ]
    : []

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold text-fjord">{groupName} Mortgage</h3>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="rounded-badge bg-fjord/10 px-2 py-0.5 text-xs font-medium text-fjord">
              Mortgage
            </span>
            <span className="text-xs text-stone">{debts.length} units</span>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-stone hover:text-fjord"
        >
          {expanded ? 'Collapse' : 'Per-unit breakdown'}
          <svg
            className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Combined totals */}
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-stone">Total Balance</p>
          <p className="text-lg font-bold text-fjord">{formatCurrency(totalBalance)}</p>
        </div>
        <div>
          <p className="text-xs text-stone">Rate</p>
          <p className="text-lg font-bold text-fjord">{(avgRate * 100).toFixed(2)}%</p>
        </div>
        <div>
          <p className="text-xs text-stone">Monthly Payment</p>
          <p className="text-lg font-bold text-fjord">{formatCurrency(totalPayment)}/mo</p>
        </div>
        <div>
          <p className="text-xs text-stone">Est. Remaining</p>
          <p className="text-lg font-bold text-fjord">
            {maxMonthsRemaining !== null
              ? `${Math.floor(maxMonthsRemaining / 12)}y ${maxMonthsRemaining % 12}m`
              : '—'}
          </p>
        </div>
      </div>

      {/* Combined PITI breakdown bar */}
      <div className="mt-4 rounded-lg border border-mist bg-snow p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-stone">
          Monthly Payment Breakdown {hasPiti && '(PITI)'}
        </p>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-pine" />
            <span className="text-stone">Principal:</span>
            <span className="font-semibold text-fjord">{formatCurrency(totalPrincipal)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-ember" />
            <span className="text-stone">Interest:</span>
            <span className="font-semibold text-fjord">{formatCurrency(totalInterest)}</span>
          </div>
          {hasPiti && escrowItems.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
              <span className="text-stone">{item.label}:</span>
              <span className="font-semibold text-fjord">{formatCurrency(item.amount)}</span>
            </div>
          ))}
        </div>

        {totalPayment > 0 && (
          <div className="mt-2 flex h-2 overflow-hidden rounded-bar">
            <div className="bg-pine" style={{ width: `${(totalPrincipal / totalPayment) * 100}%` }} />
            <div className="bg-ember" style={{ width: `${(totalInterest / totalPayment) * 100}%` }} />
            {hasPiti && escrowItems.map((item) => (
              <div key={item.label} className={item.color} style={{ width: `${(item.amount / totalPayment) * 100}%` }} />
            ))}
          </div>
        )}
      </div>

      {/* Expanded per-unit breakdown */}
      {expanded && (
        <div className="mt-4 space-y-3 border-t border-mist pt-4">
          <p className="text-xs font-medium uppercase tracking-wider text-stone">Per-Unit Breakdown</p>
          {debts.map((debt) => (
            <div key={debt.id} className="rounded-lg border border-mist bg-snow p-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-fjord">{debt.name}</p>
                  {debt.property && (
                    <p className="text-xs text-stone">
                      {debt.property.splitPct != null ? `${debt.property.splitPct}% allocation` : ''}
                      {debt.property.taxSchedule && (
                        <span className="ml-1">
                          ({debt.property.taxSchedule === 'SCHEDULE_A' ? 'Schedule A' :
                            debt.property.taxSchedule === 'SCHEDULE_E' ? 'Schedule E' :
                              debt.property.taxSchedule === 'SCHEDULE_C' ? 'Schedule C' :
                                debt.property.taxSchedule})
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => onEdit(debt)} className="text-xs text-stone hover:text-fjord">Edit</button>
                  <button onClick={() => onDelete(debt.id)} className="text-xs text-stone hover:text-ember">Delete</button>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div>
                  <span className="text-stone">Balance: </span>
                  <span className="font-mono font-medium text-fjord">{formatCurrency(debt.currentBalance)}</span>
                </div>
                <div>
                  <span className="text-stone">Payment: </span>
                  <span className="font-mono font-medium text-fjord">{formatCurrency(debt.minimumPayment)}/mo</span>
                </div>
                <div>
                  <span className="text-stone">Principal: </span>
                  <span className="font-mono font-medium text-pine">{formatCurrency(debt.monthlyPrincipal)}</span>
                </div>
                <div>
                  <span className="text-stone">Interest: </span>
                  <span className="font-mono font-medium text-ember">{formatCurrency(debt.monthlyInterest)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Card for a single (ungrouped) debt */
function SingleDebtCard({
  debt,
  properties,
  onEdit,
  onDelete,
}: {
  debt: DebtRow
  properties: PropertyOption[]
  onEdit: (debt: DebtRow) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="card">
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
        <div className="flex items-center gap-3">
          <button onClick={() => onEdit(debt)} className="text-xs text-stone hover:text-fjord">Edit</button>
          <button onClick={() => onDelete(debt.id)} className="text-xs text-stone hover:text-ember">Delete</button>
        </div>
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
          <p className="text-xs text-stone">Monthly Payment</p>
          <p className="text-lg font-bold text-fjord">{formatCurrency(debt.minimumPayment)}/mo</p>
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

      {/* PITI breakdown */}
      <DebtPITIBreakdown debt={debt} properties={properties} />

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

      {/* R5.8: Payment history */}
      {debt.transactions && debt.transactions.length > 0 && (
        <div className="mt-3 rounded-lg border border-mist bg-snow p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-stone">
            Recent Payments
          </p>
          <ul className="space-y-1">
            {debt.transactions.slice(0, 5).map((tx) => (
              <li key={tx.id} className="flex items-center justify-between text-sm">
                <span className="text-stone">
                  {new Date(tx.date).toLocaleDateString()} &middot; {tx.merchant}
                </span>
                <span className="font-mono font-semibold text-fjord">
                  {formatCurrency(Math.abs(tx.amount))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/** Enhanced PITI breakdown, effective rate, equity/LTV, and amortization schedule */
function DebtPITIBreakdown({ debt, properties }: { debt: DebtRow; properties: PropertyOption[] }) {
  const [showSchedule, setShowSchedule] = useState(false)

  const prop = debt.propertyId ? properties.find(p => p.id === debt.propertyId) : null
  const hasPiti = debt.type === 'MORTGAGE' && prop != null &&
    prop.monthlyPropertyTax != null

  // PITI line items (when available)
  const propTax = prop?.monthlyPropertyTax ?? 0
  const ins = prop?.monthlyInsurance ?? 0
  const hoa = prop?.monthlyHOA ?? 0
  const pmi = prop?.monthlyPMI ?? 0
  const escrowItems = hasPiti
    ? [
        { label: 'Property Tax', amount: propTax, color: 'bg-birch' },
        { label: 'Insurance', amount: ins, color: 'bg-lichen' },
        ...(hoa > 0 ? [{ label: 'HOA', amount: hoa, color: 'bg-mist' }] : []),
        ...(pmi > 0 ? [{ label: 'PMI', amount: pmi, color: 'bg-stone/50' }] : []),
      ]
    : []

  const totalBar = debt.minimumPayment

  // Effective rate
  const effRate = debt.type === 'MORTGAGE' && debt.currentBalance > 0
    ? calcEffectiveRate(debt.currentBalance, debt.minimumPayment)
    : null

  // Equity / LTV
  const propertyValue = prop?.currentValue ?? null
  const equity = propertyValue != null && debt.currentBalance != null
    ? propertyValue - debt.currentBalance
    : null
  const ltv = propertyValue != null && propertyValue > 0
    ? (debt.currentBalance / propertyValue) * 100
    : null

  // Amortization schedule
  const canShowSchedule = debt.currentBalance > 0 && debt.interestRate >= 0 && debt.termMonths != null && debt.termMonths > 0
  const scheduleRows: AmortizationRow[] = canShowSchedule
    ? (() => {
        try {
          const result = amortizationSchedule({
            principal: debt.currentBalance,
            annualRate: debt.interestRate,
            termMonths: debt.termMonths!,
          })
          return result.schedule
        } catch {
          return []
        }
      })()
    : []

  return (
    <>
      <div className="mt-4 rounded-lg border border-mist bg-snow p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-stone">
          Monthly Payment Breakdown {hasPiti && '(PITI)'}
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
          {hasPiti ? (
            escrowItems.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                <span className="text-stone">{item.label}:</span>
                <span className="font-semibold text-fjord">{formatCurrency(item.amount)}</span>
              </div>
            ))
          ) : debt.escrowAmount != null && debt.escrowAmount > 0 ? (
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-stone" />
              <span className="text-stone">Escrow:</span>
              <span className="font-semibold text-fjord">{formatCurrency(debt.escrowAmount)}</span>
            </div>
          ) : null}
        </div>

        {/* PITI bar */}
        {totalBar > 0 && (
          <div className="mt-2 flex h-2 overflow-hidden rounded-bar">
            <div className="bg-pine" style={{ width: `${(debt.monthlyPrincipal / totalBar) * 100}%` }} />
            <div className="bg-ember" style={{ width: `${(debt.monthlyInterest / totalBar) * 100}%` }} />
            {hasPiti ? (
              escrowItems.map((item) => (
                <div key={item.label} className={item.color} style={{ width: `${(item.amount / totalBar) * 100}%` }} />
              ))
            ) : debt.escrowAmount != null && debt.escrowAmount > 0 ? (
              <div className="bg-stone" style={{ width: `${(debt.escrowAmount / totalBar) * 100}%` }} />
            ) : null}
          </div>
        )}

        {/* Effective rate + Equity row */}
        {(effRate !== null || equity !== null) && (
          <div className="mt-3 flex flex-wrap gap-4 border-t border-mist pt-2 text-xs">
            {effRate !== null && (
              <div>
                <span className="text-stone">Effective Rate: </span>
                <span className="font-semibold text-fjord">{(effRate * 100).toFixed(2)}%</span>
                <span className="ml-1 text-stone" title="Annual cost including escrow as a percentage of loan balance">
                  (nominal {(debt.interestRate * 100).toFixed(2)}%)
                </span>
              </div>
            )}
            {equity !== null && ltv !== null && (
              <div>
                <span className="text-stone">Equity: </span>
                <span className={`font-semibold ${equity >= 0 ? 'text-pine' : 'text-ember'}`}>
                  {formatCurrency(equity)}
                </span>
                <span className="ml-1 text-stone">
                  (LTV {ltv.toFixed(1)}%)
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Amortization schedule toggle */}
      {canShowSchedule && scheduleRows.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setShowSchedule(!showSchedule)}
            className="text-xs text-stone hover:text-fjord"
          >
            {showSchedule ? 'Hide' : 'Show'} Amortization Schedule ({scheduleRows.length} months)
          </button>

          {showSchedule && (
            <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-mist bg-snow">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-frost">
                  <tr className="text-left text-stone">
                    <th className="px-2 py-1.5 font-medium">#</th>
                    <th className="px-2 py-1.5 font-medium text-right">Payment</th>
                    <th className="px-2 py-1.5 font-medium text-right">Principal</th>
                    <th className="px-2 py-1.5 font-medium text-right">Interest</th>
                    <th className="px-2 py-1.5 font-medium text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleRows.map((row) => (
                    <tr key={row.month} className="border-t border-mist/50">
                      <td className="px-2 py-1 text-stone">{row.month}</td>
                      <td className="px-2 py-1 text-right font-mono text-fjord">{formatCurrency(row.payment)}</td>
                      <td className="px-2 py-1 text-right font-mono text-pine">{formatCurrency(row.principal)}</td>
                      <td className="px-2 py-1 text-right font-mono text-ember">{formatCurrency(row.interest)}</td>
                      <td className="px-2 py-1 text-right font-mono text-fjord">{formatCurrency(row.remainingBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  )
}
