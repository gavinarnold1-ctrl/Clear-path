'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ProgressBar from '@/components/ui/ProgressBar'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/Modal'
import { formatCurrency, budgetProgress } from '@/lib/utils'
import { formatMonthName } from '@/lib/budget-engine'
import FundExpenseModal from './FundExpenseModal'
import MarkSpentModal from './MarkSpentModal'
import LinkTransactionModal from './LinkTransactionModal'

interface CategoryOption {
  id: string
  name: string
  icon: string | null
}

interface PropertyOption {
  id: string
  name: string
  type: string
}

interface AnnualExpenseData {
  id: string
  name: string
  annualAmount: number
  dueMonth: number
  dueYear: number
  isRecurring: boolean
  monthlySetAside: number
  funded: number
  status: string
  actualCost: number | null
  actualDate: string | null
  notes: string | null
  monthsRemaining: number
  currentSetAside: number
  computedStatus: string
  linkedSpent?: number
  propertyId?: string | null
  property?: { id: string; name: string; type: string } | null
  budget: {
    id: string
    categoryId: string | null
    category: { name: string; icon: string | null } | null
  }
}

interface Props {
  expense: AnnualExpenseData
  affordableMonthly?: number
  categories?: CategoryOption[]
  properties?: PropertyOption[]
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  overdue: { label: 'OVERDUE', className: 'border-ember/30 bg-ember/10 text-ember' },
  urgent: { label: 'URGENT', className: 'border-ember/30 bg-ember/10 text-ember' },
  behind: { label: 'BEHIND', className: 'border-birch/30 bg-birch/10 text-birch' },
  planned: { label: 'ON TRACK', className: 'border-lichen/30 bg-lichen/10 text-lichen' },
  funded: { label: 'FUNDED', className: 'border-pine/30 bg-pine/10 text-pine' },
  spent: { label: 'SPENT', className: 'border-mist bg-snow text-stone' },
  overspent: { label: 'OVERSPENT', className: 'border-ember/30 bg-ember/10 text-ember' },
}

export default function AnnualExpenseCard({ expense, affordableMonthly, categories = [], properties = [] }: Props) {
  const router = useRouter()
  const [fundOpen, setFundOpen] = useState(false)
  const [spentOpen, setSpentOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Edit state
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(expense.name)
  const [editAmount, setEditAmount] = useState(String(expense.annualAmount))
  const [editCategoryId, setEditCategoryId] = useState(expense.budget.categoryId ?? '')
  const [editDueMonth, setEditDueMonth] = useState(String(expense.dueMonth))
  const [editDueYear, setEditDueYear] = useState(String(expense.dueYear))
  const [editIsRecurring, setEditIsRecurring] = useState(expense.isRecurring)
  const [editNotes, setEditNotes] = useState(expense.notes ?? '')
  const [editPropertyId, setEditPropertyId] = useState(expense.propertyId ?? '')
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const pct = budgetProgress(expense.funded, expense.annualAmount)
  const isCompleted = expense.status === 'spent' || expense.status === 'overspent'
  const badgeKey = isCompleted ? expense.status : expense.computedStatus
  const badge = STATUS_BADGES[badgeKey] ?? STATUS_BADGES.planned
  const icon = expense.budget.category?.icon

  async function handleFund(amount: number) {
    setLoading(true)
    try {
      const res = await fetch(`/api/budgets/annual/${expense.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fund', amount }),
      })
      if (!res.ok) throw new Error('Failed to add funds')
      router.refresh()
    } finally {
      setLoading(false)
      setFundOpen(false)
    }
  }

  async function handleMarkSpent(actualCost: number, actualDate: Date, notes?: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/budgets/annual/${expense.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'markSpent',
          actualCost,
          actualDate: actualDate.toISOString(),
          notes,
        }),
      })
      if (!res.ok) throw new Error('Failed to mark as spent')
      router.refresh()
    } finally {
      setLoading(false)
      setSpentOpen(false)
    }
  }

  async function handleDelete() {
    setLoading(true)
    try {
      const res = await fetch(`/api/budgets/annual/${expense.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      router.refresh()
    } finally {
      setLoading(false)
      setDeleteOpen(false)
    }
  }

  function startEdit() {
    setEditName(expense.name)
    setEditAmount(String(expense.annualAmount))
    setEditCategoryId(expense.budget.categoryId ?? '')
    setEditDueMonth(String(expense.dueMonth))
    setEditDueYear(String(expense.dueYear))
    setEditIsRecurring(expense.isRecurring)
    setEditNotes(expense.notes ?? '')
    setEditPropertyId(expense.propertyId ?? '')
    setEditError('')
    setIsEditing(true)
  }

  async function handleEditSave() {
    if (!editName.trim()) { setEditError('Name is required'); return }
    const amount = parseFloat(editAmount)
    if (isNaN(amount) || amount <= 0) { setEditError('Amount must be a positive number'); return }

    setEditSaving(true)
    setEditError('')

    try {
      const res = await fetch(`/api/budgets/annual/${expense.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit',
          name: editName.trim(),
          annualAmount: amount,
          categoryId: editCategoryId || null,
          propertyId: editPropertyId || null,
          dueMonth: parseInt(editDueMonth),
          dueYear: parseInt(editDueYear),
          isRecurring: editIsRecurring,
          notes: editNotes.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to save')
      }
      setIsEditing(false)
      router.refresh()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setEditSaving(false)
    }
  }

  const currentYear = new Date().getFullYear()

  return (
    <>
      <div className={`card ${isCompleted ? 'opacity-70' : ''}`}>
        {isEditing ? (
          /* Edit form */
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-fjord">Edit Annual Expense</h3>
            <div>
              <label className="block text-xs font-medium text-stone">Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="input mt-1 w-full text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone">Annual Amount</label>
              <input
                type="number"
                step="0.01"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className="input mt-1 w-full text-sm"
              />
            </div>
            {categories.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-stone">Category</label>
                <select
                  value={editCategoryId}
                  onChange={(e) => setEditCategoryId(e.target.value)}
                  className="input mt-1 w-full text-sm"
                >
                  <option value="">No category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {properties.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-stone">Property (optional)</label>
                <select
                  value={editPropertyId}
                  onChange={(e) => setEditPropertyId(e.target.value)}
                  className="input mt-1 w-full text-sm"
                >
                  <option value="">No property</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone">Due Month</label>
                <select
                  value={editDueMonth}
                  onChange={(e) => setEditDueMonth(e.target.value)}
                  className="input mt-1 w-full text-sm"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {formatMonthName(i + 1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone">Due Year</label>
                <select
                  value={editDueYear}
                  onChange={(e) => setEditDueYear(e.target.value)}
                  className="input mt-1 w-full text-sm"
                >
                  {[currentYear, currentYear + 1, currentYear + 2].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editIsRecurring}
                onChange={(e) => setEditIsRecurring(e.target.checked)}
                className="rounded border-mist"
              />
              <span className="text-xs text-fjord">Repeat every year</span>
            </label>
            <div>
              <label className="block text-xs font-medium text-stone">Notes</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={2}
                className="input mt-1 w-full text-sm"
                placeholder="Any details about this expense..."
              />
            </div>
            {editError && <p className="text-xs text-ember">{editError}</p>}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-1 text-xs text-stone hover:text-fjord"
                disabled={editSaving}
              >
                Cancel
              </button>
              <Button
                size="sm"
                onClick={handleEditSave}
                disabled={editSaving}
                loading={editSaving}
                loadingText="Saving..."
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          /* Normal display */
          <>
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-semibold text-fjord">
                  {icon && <span className="text-lg">{icon}</span>}
                  <Link
                    href={`/transactions?annualExpenseId=${expense.id}&annualExpenseName=${encodeURIComponent(expense.name)}`}
                    className={`hover:text-midnight hover:underline ${isCompleted ? 'line-through' : ''}`}
                  >
                    {expense.name}
                  </Link>
                  {expense.isRecurring && (
                    <span className="rounded bg-mist px-1.5 py-0.5 text-[10px] font-medium text-stone">
                      yearly
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-sm text-stone">
                  {formatCurrency(expense.annualAmount)} planned &middot; Due{' '}
                  {formatMonthName(expense.dueMonth)} {expense.dueYear}
                  {expense.property && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-frost px-2 py-0.5 text-xs text-stone">
                      {expense.property.name}
                    </span>
                  )}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}
              >
                {badge.label}
              </span>
            </div>

            {/* Progress — dual bars: Funded (pine) + Spent (ember/birch) */}
            <div className="mt-3">
              {/* Set-aside bar (primary — manual set-asides) */}
              <div className="mb-0.5 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-stone">
                <span>Set Aside</span>
                <span>{formatCurrency(expense.funded)} / {formatCurrency(expense.annualAmount)}</span>
              </div>
              <ProgressBar value={pct} />
              <div className="mt-0.5 flex justify-between text-xs text-stone">
                <span>{formatCurrency(Math.max(0, expense.annualAmount - expense.funded))} remaining</span>
                <span className="font-medium">{pct}%</span>
              </div>

              {/* Spent bar (from linked transactions — separate from set-aside) */}
              {expense.linkedSpent !== undefined && expense.linkedSpent > 0 && (() => {
                const spentPct = budgetProgress(expense.linkedSpent, expense.annualAmount)
                const spentOverFunded = expense.linkedSpent > expense.funded
                return (
                  <div className="mt-2">
                    <div className="mb-0.5 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-stone">
                      <span>Spent</span>
                      <span className={spentOverFunded ? 'text-ember' : ''}>
                        {formatCurrency(expense.linkedSpent)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-bar bg-mist">
                      <div
                        className={`h-full rounded-bar transition-all duration-300 ${spentOverFunded ? 'bg-ember' : 'bg-birch'}`}
                        style={{ width: `${Math.min(spentPct, 100)}%` }}
                      />
                    </div>
                    {spentOverFunded && (
                      <p className="mt-1 text-xs font-medium text-ember">
                        Spent {formatCurrency(expense.linkedSpent - expense.funded)} more than set aside
                      </p>
                    )}
                  </div>
                )
              })()}

              {/* Net position summary */}
              <div className="mt-2 text-xs text-stone">
                {expense.linkedSpent !== undefined && expense.linkedSpent > 0 ? (
                  expense.linkedSpent >= expense.annualAmount ? (
                    <span className="font-medium text-pine">Fully paid &mdash; {formatCurrency(expense.linkedSpent)} spent</span>
                  ) : (
                    <span>
                      {formatCurrency(expense.annualAmount - expense.linkedSpent)} still owed
                      {expense.funded > expense.linkedSpent && (
                        <> &middot; {formatCurrency(expense.funded - expense.linkedSpent)} set aside for remaining</>
                      )}
                    </span>
                  )
                ) : (
                  expense.funded > 0 ? (
                    <span>{formatCurrency(expense.funded)} set aside &middot; no payments linked yet</span>
                  ) : (
                    <span>No funds set aside and no payments linked</span>
                  )
                )}
              </div>

              {/* Info banner when funds set aside but no transactions linked */}
              {expense.funded > 0 && (!expense.linkedSpent || expense.linkedSpent === 0) && (
                <div className="mt-2 rounded bg-birch/20 px-3 py-1.5 text-xs text-stone">
                  You&apos;ve set aside {formatCurrency(expense.funded)} but no transactions are linked yet.
                  Use &ldquo;Link Transaction&rdquo; to connect actual payments.
                </div>
              )}
            </div>

            {/* Details */}
            {isCompleted ? (
              <div className="mt-3 text-sm text-stone">
                {expense.actualCost !== null && (
                  <p>
                    {formatCurrency(expense.actualCost)} actual
                    {expense.actualCost !== expense.annualAmount && (
                      <span>
                        {' '}
                        (vs {formatCurrency(expense.annualAmount)} planned &mdash;{' '}
                        {expense.actualCost < expense.annualAmount ? (
                          <span className="text-pine">
                            saved {formatCurrency(expense.annualAmount - expense.actualCost)}
                          </span>
                        ) : (
                          <span className="text-ember">
                            over by {formatCurrency(expense.actualCost - expense.annualAmount)}
                          </span>
                        )}
                        )
                      </span>
                    )}
                  </p>
                )}
                {expense.actualDate && (
                  <p className="text-xs text-stone">
                    Completed{' '}
                    {new Date(expense.actualDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                )}
              </div>
            ) : (
              <>
                <p className="mt-2 text-sm text-stone">
                  {formatCurrency(expense.currentSetAside)}/mo needed &middot;{' '}
                  {expense.monthsRemaining} month{expense.monthsRemaining !== 1 ? 's' : ''} remaining
                </p>
                {affordableMonthly !== undefined &&
                  affordableMonthly < expense.currentSetAside &&
                  expense.monthsRemaining > 0 && (() => {
                    const remaining = expense.annualAmount - expense.funded
                    const projectedFunding = affordableMonthly * expense.monthsRemaining
                    const shortfall = remaining - projectedFunding
                    return shortfall > 0 ? (
                      <p className="mt-1 text-xs font-medium text-ember">
                        At current pace, you&apos;ll be {formatCurrency(shortfall)} short by the due date
                      </p>
                    ) : null
                  })()}
              </>
            )}

            {/* Notes */}
            {expense.notes && (
              <p className="mt-2 text-xs text-stone italic">{expense.notes}</p>
            )}

            {/* Actions */}
            <div className="mt-3 flex items-center gap-2 border-t border-mist pt-3">
              {isCompleted ? (
                <span className="text-xs font-medium text-pine">Completed &#x2713;</span>
              ) : (
                <>
                  <Button
                    size="sm"
                    onClick={() => setFundOpen(true)}
                    disabled={loading}
                  >
                    Add Funds
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setLinkOpen(true)}
                    disabled={loading}
                  >
                    Link Transaction
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSpentOpen(true)}
                    disabled={loading}
                  >
                    Mark as Spent
                  </Button>
                </>
              )}
              <button
                onClick={startEdit}
                disabled={loading}
                className="text-xs text-stone hover:text-fjord"
              >
                Edit
              </button>
              <button
                onClick={() => setDeleteOpen(true)}
                disabled={loading}
                className="ml-auto text-xs text-stone hover:text-ember"
              >
                Delete
              </button>
            </div>
          </>
        )}
      </div>

      <FundExpenseModal
        expense={expense}
        isOpen={fundOpen}
        onClose={() => setFundOpen(false)}
        onSubmit={handleFund}
      />
      <MarkSpentModal
        expense={expense}
        isOpen={spentOpen}
        onClose={() => setSpentOpen(false)}
        onSubmit={handleMarkSpent}
      />
      <LinkTransactionModal
        expenseId={expense.id}
        expenseName={expense.name}
        isOpen={linkOpen}
        onClose={() => setLinkOpen(false)}
        onLinked={() => router.refresh()}
      />
      <ConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title={`Delete "${expense.name}"?`}
        description="This cannot be undone."
        confirmLabel="Delete"
        loading={loading}
        variant="danger"
      />
    </>
  )
}
