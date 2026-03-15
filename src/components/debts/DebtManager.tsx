'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { trackDebtCreated } from '@/lib/analytics'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { FormInput } from '@/components/ui/FormInput'
import { FormSelect } from '@/components/ui/FormSelect'
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
  // CC intelligence fields
  ccBehavior?: string | null
  observedInterestRate?: number | null
  avgMonthlySpend?: number | null
  monthsCarried?: number | null
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
      trackDebtCreated(formType, currentBalance, interestRate)
      resetForm()
      setShowForm(false)
      toast.success('Debt added')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create debt')
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
      toast.success('Debt updated')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update debt')
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
      toast.success('Debt deleted')
      router.refresh()
    } catch {
      setDebts(prev)
      toast.error('Failed to delete debt')
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
        <div className="card">
          <EmptyState
            icon={<svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>}
            title="No debts tracked yet"
            description="Add your loans, credit cards, and mortgages to track payoff progress."
            action={{ label: 'Add a debt', onClick: () => setShowForm(true) }}
          />
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
            <Button
              onClick={() => { resetForm(); setShowForm(true) }}
              className="mt-4"
            >
              + Add debt
            </Button>
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
              <FormInput
                label="Name"
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Mortgage - 123 Main St"
              />
              <FormSelect
                label="Type"
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
              >
                {DEBT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </FormSelect>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormInput
                label="Current Balance"
                type="number"
                step="0.01"
                min="0"
                value={formBalance}
                onChange={(e) => setFormBalance(e.target.value)}
                startAdornment="$"
                placeholder="0.00"
              />
              <FormInput
                label="Interest Rate (%)"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formRate}
                onChange={(e) => setFormRate(e.target.value)}
                placeholder="5.30"
              />
              <FormInput
                label="Total Monthly Payment"
                type="number"
                step="0.01"
                min="0"
                value={formPayment}
                onChange={(e) => setFormPayment(e.target.value)}
                startAdornment="$"
                placeholder="0.00"
              />
            </div>

            {formType === 'MORTGAGE' && (
              <FormInput
                label="Monthly Escrow (taxes & insurance) (optional)"
                type="number"
                step="0.01"
                min="0"
                value={formEscrowAmount}
                onChange={(e) => setFormEscrowAmount(e.target.value)}
                startAdornment="$"
                placeholder="0.00"
              />
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormInput
                label="Original Balance (optional)"
                type="number"
                step="0.01"
                min="0"
                value={formOriginalBalance}
                onChange={(e) => setFormOriginalBalance(e.target.value)}
                startAdornment="$"
                placeholder="0.00"
              />
              <FormInput
                label="Payment Day (optional)"
                type="number"
                min="1"
                max="31"
                value={formPaymentDay}
                onChange={(e) => setFormPaymentDay(e.target.value)}
                placeholder="15"
              />
              <FormInput
                label="Term (months) (optional)"
                type="number"
                min="1"
                value={formTermMonths}
                onChange={(e) => setFormTermMonths(e.target.value)}
                placeholder="360"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {properties.length > 0 && (
                <FormSelect
                  label="Property (optional)"
                  value={formPropertyId}
                  onChange={(e) => setFormPropertyId(e.target.value)}
                >
                  <option value="">No property</option>
                  {properties.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </FormSelect>
              )}
              <FormSelect
                label="Category (optional)"
                value={formCategoryId}
                onChange={(e) => setFormCategoryId(e.target.value)}
              >
                <option value="">No category</option>
                {Object.entries(groupedCategories).map(([group, cats]) => (
                  <optgroup key={group} label={group}>
                    {cats.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </optgroup>
                ))}
              </FormSelect>
            </div>
          </div>

          <div className="mt-5 flex gap-3">
            <Button
              onClick={editingId ? handleUpdate : handleCreate}
              loading={saving}
              loadingText="Saving…"
            >
              {editingId ? 'Save Changes' : 'Add Debt'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => { setShowForm(false); resetForm() }}
            >
              Cancel
            </Button>
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
          <p className="font-mono text-lg font-bold text-fjord">{formatCurrency(totalBalance)}</p>
        </div>
        <div>
          <p className="text-xs text-stone">Rate</p>
          <p className="font-mono text-lg font-bold text-fjord">{(avgRate * 100).toFixed(2)}%</p>
        </div>
        <div>
          <p className="text-xs text-stone">Monthly Payment</p>
          <p className="font-mono text-lg font-bold text-fjord">{formatCurrency(totalPayment)}/mo</p>
        </div>
        <div>
          <p className="text-xs text-stone">Est. Remaining</p>
          <p className="font-mono text-lg font-bold text-fjord">
            {maxMonthsRemaining !== null
              ? `${Math.floor(maxMonthsRemaining / 12)}y ${maxMonthsRemaining % 12}m`
              : '—'}
          </p>
        </div>
      </div>

      {/* Combined PITI breakdown bar */}
      <div className="mt-4 rounded-lg border border-mist bg-snow p-3">
        <p className="mb-2 text-xs font-medium text-stone">
          Monthly payment breakdown {hasPiti && '(PITI)'}
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

      {/* Effective rate + Equity row */}
      <GroupedDebtExtras
        totalBalance={totalBalance}
        totalPayment={totalPayment}
        avgRate={avgRate}
        debts={debts}
        properties={properties}
      />

      {/* Expanded per-unit breakdown */}
      {expanded && (
        <div className="mt-4 space-y-3 border-t border-mist pt-4">
          <p className="text-xs font-medium text-stone">Per-unit breakdown</p>
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
                  <button onClick={(e) => { e.stopPropagation(); onEdit(debt) }} className="text-xs text-stone hover:text-fjord">Edit</button>
                  <button onClick={(e) => { e.stopPropagation(); onDelete(debt.id) }} className="text-xs text-stone hover:text-ember">Delete</button>
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

/** Effective rate, equity/LTV, payoff progress, and amortization schedule for grouped debts */
function GroupedDebtExtras({
  totalBalance,
  totalPayment,
  avgRate,
  debts,
  properties,
}: {
  totalBalance: number
  totalPayment: number
  avgRate: number
  debts: DebtRow[]
  properties: PropertyOption[]
}) {
  const [showSchedule, setShowSchedule] = useState(false)

  // Effective rate (P&I only — excludes escrow)
  const totalEscrow = debts.reduce((s, d) => s + (d.escrowAmount ?? 0), 0)
  const piOnlyPayment = totalPayment - totalEscrow
  const maxMonthsRemaining = debts.reduce<number | null>((max, d) => {
    if (d.monthsRemaining == null) return max
    if (max == null) return d.monthsRemaining
    return Math.max(max, d.monthsRemaining)
  }, null)
  const effRate = totalBalance > 0
    ? calcEffectiveRate(totalBalance, piOnlyPayment, maxMonthsRemaining)
    : null

  // Combined equity/LTV across all units
  const totalPropertyValue = debts.reduce((s, d) => {
    const prop = d.propertyId ? properties.find(p => p.id === d.propertyId) : null
    return s + (prop?.currentValue ?? 0)
  }, 0)
  const equity = totalPropertyValue > 0 ? totalPropertyValue - totalBalance : null
  const ltv = totalPropertyValue > 0 ? (totalBalance / totalPropertyValue) * 100 : null

  // Combined original balance for payoff progress
  const totalOriginalBalance = debts.reduce((s, d) => s + (d.originalBalance ?? 0), 0)

  // Amortization schedule using combined values
  // Use max termMonths from any unit debt
  const maxTermMonths = debts.reduce<number | null>((max, d) => {
    if (d.termMonths == null) return max
    if (max == null) return d.termMonths
    return Math.max(max, d.termMonths)
  }, null)

  const canShowSchedule = totalBalance > 0 && avgRate >= 0 && maxTermMonths != null && maxTermMonths > 0
  const scheduleRows: AmortizationRow[] = canShowSchedule
    ? (() => {
        try {
          const result = amortizationSchedule({
            principal: totalBalance,
            annualRate: avgRate,
            termMonths: maxTermMonths!,
          })
          return result.schedule
        } catch {
          return []
        }
      })()
    : []

  return (
    <>
      {/* Effective rate + Equity row */}
      {(effRate !== null || equity !== null) && (
        <div className="mt-3 flex flex-wrap gap-4 text-xs">
          {effRate !== null && (
            <div>
              <span className="text-stone">Effective Rate: </span>
              <span className="font-semibold text-fjord">{(effRate * 100).toFixed(2)}%</span>
              <span className="ml-1 text-stone">(nominal {(avgRate * 100).toFixed(2)}%)</span>
            </div>
          )}
          {equity !== null && ltv !== null && (
            <div>
              <span className="text-stone">Combined Equity: </span>
              <span className={`font-semibold ${equity >= 0 ? 'text-pine' : 'text-ember'}`}>
                {formatCurrency(equity)}
              </span>
              <span className="ml-1 text-stone">(LTV {ltv.toFixed(1)}%)</span>
            </div>
          )}
        </div>
      )}

      {/* Payoff progress */}
      {totalOriginalBalance > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-stone">
            <span>Payoff progress</span>
            <span>
              {(((totalOriginalBalance - totalBalance) / totalOriginalBalance) * 100).toFixed(1)}%
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-bar bg-mist">
            <div
              className="h-full rounded-bar bg-pine"
              style={{
                width: `${((totalOriginalBalance - totalBalance) / totalOriginalBalance) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

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
  const isCC = debt.type === 'CREDIT_CARD'
  const ccBehavior = debt.ccBehavior

  // CC behavior determines accent color
  const rateAccent = isCC
    ? ccBehavior === 'pays_in_full' ? 'border-l-pine'
    : ccBehavior === 'revolving' ? 'border-l-ember'
    : ccBehavior === 'mixed' ? 'border-l-birch'
    : 'border-l-stone'
    : debt.interestRate >= 0.07 ? 'border-l-ember' : debt.interestRate >= 0.04 ? 'border-l-birch' : 'border-l-pine'

  return (
    <div className={`card border-l-4 ${rateAccent}`}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold text-fjord">{debt.name}</h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className="rounded-badge bg-fjord/10 px-2 py-0.5 text-xs font-medium text-fjord">
              {debtTypeLabel(debt.type)}
            </span>
            {isCC && ccBehavior === 'pays_in_full' && (
              <span className="rounded-badge bg-pine/10 px-2 py-0.5 text-xs font-medium text-pine">Paid in full monthly</span>
            )}
            {isCC && ccBehavior === 'revolving' && (
              <span className="rounded-badge bg-ember/10 px-2 py-0.5 text-xs font-medium text-ember">Carrying balance</span>
            )}
            {isCC && ccBehavior === 'mixed' && (
              <span className="rounded-badge bg-birch/10 px-2 py-0.5 text-xs font-medium text-birch">Sometimes carries balance</span>
            )}
            {isCC && ccBehavior === 'insufficient_data' && (
              <span className="rounded-badge bg-stone/10 px-2 py-0.5 text-xs font-medium text-stone">Monitoring...</span>
            )}
            {debt.property && (
              <span className="text-xs text-stone">{debt.property.name}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={(e) => { e.stopPropagation(); onEdit(debt) }} className="text-xs text-stone hover:text-fjord">Edit</button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(debt.id) }} className="text-xs text-stone hover:text-ember">Delete</button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-stone">Balance</p>
          <p className="font-mono text-lg font-bold text-fjord">{formatCurrency(debt.currentBalance)}</p>
        </div>
        {isCC && ccBehavior === 'pays_in_full' ? (
          <>
            <div>
              <p className="text-xs text-stone">Avg Monthly Spend</p>
              <p className="font-mono text-lg font-bold text-fjord">{formatCurrency(debt.avgMonthlySpend ?? 0)}/mo</p>
            </div>
            <div>
              <p className="text-xs text-stone">Interest Cost</p>
              <p className="font-mono text-lg font-bold text-pine">$0</p>
            </div>
            <div>
              <p className="text-xs text-stone">Status</p>
              <p className="text-sm font-semibold text-pine">No interest cost</p>
            </div>
          </>
        ) : isCC && ccBehavior === 'revolving' ? (
          <>
            <div>
              <p className="text-xs text-stone">Observed APR</p>
              <p className="font-mono text-lg font-bold text-ember">
                {debt.observedInterestRate != null ? `~${(debt.observedInterestRate * 100).toFixed(1)}%` : `${(debt.interestRate * 100).toFixed(2)}%`}
              </p>
            </div>
            <div>
              <p className="text-xs text-stone">~Interest/mo</p>
              <p className="font-mono text-lg font-bold text-ember">{formatCurrency(debt.monthlyInterest)}/mo</p>
            </div>
            <div>
              <p className="text-xs text-stone">Balance Carried</p>
              <p className="font-mono text-lg font-bold text-fjord">{debt.monthsCarried ?? 0} months</p>
            </div>
          </>
        ) : isCC && ccBehavior === 'mixed' ? (
          <>
            <div>
              <p className="text-xs text-stone">Observed APR</p>
              <p className="font-mono text-lg font-bold text-birch">
                {debt.observedInterestRate != null ? `~${(debt.observedInterestRate * 100).toFixed(1)}%` : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-stone">Avg Monthly Spend</p>
              <p className="font-mono text-lg font-bold text-fjord">{formatCurrency(debt.avgMonthlySpend ?? 0)}/mo</p>
            </div>
            <div>
              <p className="text-xs text-stone">Months Carried</p>
              <p className="font-mono text-lg font-bold text-fjord">{debt.monthsCarried ?? 0} of 6</p>
            </div>
          </>
        ) : isCC && ccBehavior === 'insufficient_data' ? (
          <>
            <div className="sm:col-span-3">
              <p className="text-xs text-stone">Status</p>
              <p className="text-sm text-stone">Analyzing payment patterns (need 2+ months)</p>
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="text-xs text-stone">Rate</p>
              <p className={`font-mono text-lg font-bold ${debt.interestRate >= 0.07 ? 'text-ember' : debt.interestRate >= 0.04 ? 'text-birch' : 'text-pine'}`}>{(debt.interestRate * 100).toFixed(2)}%</p>
            </div>
            <div>
              <p className="text-xs text-stone">Monthly Payment</p>
              <p className="font-mono text-lg font-bold text-fjord">{formatCurrency(debt.minimumPayment)}/mo</p>
            </div>
            <div>
              <p className="text-xs text-stone">Est. Remaining</p>
              <p className="font-mono text-lg font-bold text-fjord">
                {debt.monthsRemaining !== null
                  ? `${Math.floor(debt.monthsRemaining / 12)}y ${debt.monthsRemaining % 12}m`
                  : '—'}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Negative amortization warning: payment doesn't cover interest */}
      {debt.monthsRemaining === null && debt.currentBalance > 0 && debt.interestRate > 0 && debt.minimumPayment > 0 && debt.monthlyPrincipal === 0 && (
        <div className="mt-2 rounded-button border border-ember/30 bg-ember/5 px-3 py-2 text-xs text-ember">
          Payment of {formatCurrency(debt.minimumPayment)}/mo does not cover monthly interest of {formatCurrency(debt.monthlyInterest)}. Balance is growing each month. Consider increasing your payment above {formatCurrency(debt.monthlyInterest)}/mo.
        </div>
      )}

      {/* Plaid-imported debt with missing rate/payment */}
      {debt.currentBalance > 0 && debt.interestRate === 0 && debt.minimumPayment === 0 && (
        <div className="mt-2 rounded-button border border-birch/30 bg-birch/5 px-3 py-2 text-xs text-stone">
          Rate and payment data not available from your bank. Edit this debt to add your interest rate and minimum payment for accurate payoff tracking.
        </div>
      )}

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
          <p className="mb-2 text-xs font-medium text-stone">
            Recent payments
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

  // Effective rate (P&I only — excludes escrow)
  const piPayment = debt.minimumPayment - (debt.escrowAmount ?? 0)
  const effRate = debt.type === 'MORTGAGE' && debt.currentBalance > 0
    ? calcEffectiveRate(debt.currentBalance, piPayment, debt.monthsRemaining)
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
        <p className="mb-2 text-xs font-medium text-stone">
          Monthly payment breakdown {hasPiti && '(PITI)'}
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
                <span className="ml-1 text-stone" title="Effective interest rate based on actual P&I payment">
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
