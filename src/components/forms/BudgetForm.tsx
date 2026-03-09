'use client'

import { useState, useMemo } from 'react'
import { useActionState } from 'react'
import toast from 'react-hot-toast'
import { createBudget, updateBudget } from '@/app/actions/budgets'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/Modal'
import { FormInput } from '@/components/ui/FormInput'
import { FormSelect } from '@/components/ui/FormSelect'
import GoalImpactTooltip from '@/components/budgets/GoalImpactTooltip'
import { computeBudgetChangeImpact } from '@/lib/goal-targets'
import type { GoalTarget } from '@/types'

interface CategoryOption {
  id: string
  name: string
  type: string
}

interface InitialBudget {
  id: string
  name: string
  amount: number
  tier: string
  period: string
  categoryId: string | null
  startDate: string
  endDate: string | null
  dueDay: number | null
  isAutoPay: boolean | null
  varianceLimit: number | null
}

interface Autofill {
  categoryId: string
  name: string
  amount: number
  tier: string
}

interface Props {
  categories: CategoryOption[]
  initialBudget?: InitialBudget
  autofill?: Autofill
  goalTarget?: GoalTarget
  currentSurplus?: number
}

const initialState = { error: null }

const TIERS = [
  { value: 'FIXED', label: 'Fixed', desc: 'Predictable recurring bills (rent, insurance, subscriptions)' },
  { value: 'FLEXIBLE', label: 'Flexible', desc: 'Variable spending you control (groceries, dining, fun)' },
  { value: 'ANNUAL', label: 'Annual', desc: 'Irregular expenses you plan for (vacation, holidays, repairs)' },
]

const PERIODS = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'YEARLY', label: 'Yearly' },
  { value: 'CUSTOM', label: 'Custom range' },
]

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  .toISOString()
  .split('T')[0]

const currentYear = new Date().getFullYear()

export default function BudgetForm({ categories, initialBudget, autofill, goalTarget, currentSurplus }: Props) {
  const isEdit = !!initialBudget
  const action = isEdit ? updateBudget : createBudget
  const [state, formAction, isPending] = useActionState(action, initialState)
  const [tier, setTier] = useState(initialBudget?.tier ?? autofill?.tier ?? 'FLEXIBLE')
  const [deleting, setDeleting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editAmount, setEditAmount] = useState<string>(String(initialBudget?.amount ?? autofill?.amount ?? ''))
  const expenseCategories = categories.filter((c) => c.type === 'expense')

  // Compute goal impact when amount changes
  const goalImpact = useMemo(() => {
    if (!goalTarget || currentSurplus === undefined || !initialBudget) return null
    const newAmount = parseFloat(editAmount)
    if (isNaN(newAmount)) return null
    const delta = newAmount - initialBudget.amount
    if (delta === 0) return null
    return computeBudgetChangeImpact(goalTarget, currentSurplus, delta)
  }, [goalTarget, currentSurplus, initialBudget, editAmount])

  async function handleDelete() {
    if (!initialBudget) return
    setDeleteOpen(false)
    setDeleting(true)
    try {
      const res = await fetch(`/api/budgets/${initialBudget.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Failed to delete budget')
        setDeleting(false)
        return
      }
      toast.success('Budget deleted')
      window.location.href = '/budgets'
    } catch {
      toast.error('Failed to delete budget')
      setDeleting(false)
    }
  }

  return (
    <form action={formAction} className="space-y-5">
      {isEdit && <input type="hidden" name="id" value={initialBudget.id} />}

      {state?.error && (
        <p className="rounded-lg bg-ember/10 p-3 text-sm text-ember" role="alert">
          {state.error}
        </p>
      )}

      {/* Tier selector — disabled in edit mode (tier can't change) */}
      <div>
        <label className="mb-2 block text-sm font-medium text-fjord">Budget type</label>
        <div className="grid grid-cols-3 gap-2">
          {TIERS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => !isEdit && setTier(t.value)}
              disabled={isEdit}
              className={`rounded-lg border-2 p-3 text-left transition-colors ${
                tier === t.value
                  ? 'border-fjord bg-frost'
                  : 'border-mist hover:border-mist'
              } ${isEdit ? 'cursor-default opacity-60' : ''}`}
            >
              <p className="text-sm font-semibold text-fjord">{t.label}</p>
              <p className="mt-0.5 text-xs text-stone">{t.desc}</p>
            </button>
          ))}
        </div>
        <input type="hidden" name="tier" value={tier} />
      </div>

      {/* Name */}
      <FormInput
        label="Budget name"
        name="name"
        type="text"
        defaultValue={initialBudget?.name ?? autofill?.name ?? ''}
        placeholder={
          tier === 'FIXED' ? 'e.g. Rent, Internet, Car Insurance'
          : tier === 'ANNUAL' ? 'e.g. Summer Vacation, Christmas Gifts'
          : 'e.g. Grocery Budget, Dining Out'
        }
        required
      />

      {/* Amount — FIXED and FLEXIBLE */}
      {(tier === 'FIXED' || tier === 'FLEXIBLE') && (
        <div>
          <FormInput
            label={tier === 'FIXED' ? 'Monthly amount' : 'Spending limit'}
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            startAdornment="$"
            defaultValue={initialBudget?.amount ?? autofill?.amount ?? ''}
            placeholder="0.00"
            required
            onChange={(e: { target: { value: string } }) => setEditAmount(e.target.value)}
          />
          {!isEdit && autofill && autofill.amount > 0 && (
            <p className="mt-1 text-xs text-stone">
              Based on ~${autofill.amount}/mo average spending (last 3 months)
            </p>
          )}
          {goalImpact && (
            <GoalImpactTooltip
              monthsShifted={goalImpact.monthsShifted}
              newProjectedDate={goalImpact.newProjectedDate}
              isVisible
            />
          )}
        </div>
      )}

      {/* FIXED-specific fields */}
      {tier === 'FIXED' && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="Due day (1-31)"
              name="dueDay"
              type="number"
              min="1"
              max="31"
              defaultValue={initialBudget?.dueDay ?? ''}
              placeholder="1"
            />
            <FormInput
              label="Variance limit ($)"
              name="varianceLimit"
              type="number"
              step="0.01"
              min="0"
              defaultValue={initialBudget?.varianceLimit ?? ''}
              placeholder="0.00"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="isAutoPay"
              name="isAutoPay"
              type="checkbox"
              value="true"
              defaultChecked={initialBudget?.isAutoPay ?? false}
              className="h-4 w-4 rounded border-mist text-fjord"
            />
            <label htmlFor="isAutoPay" className="text-sm text-fjord">
              Auto-pay enabled
            </label>
          </div>
        </>
      )}

      {/* FLEXIBLE-specific fields */}
      {tier === 'FLEXIBLE' && (
        <>
          <FormSelect label="Period" name="period" defaultValue={initialBudget?.period ?? 'MONTHLY'} required>
            {PERIODS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </FormSelect>
          <FormInput
            label="End date (optional — leave blank for rolling)"
            name="endDate"
            type="date"
            defaultValue={initialBudget?.endDate ?? ''}
          />
        </>
      )}

      {/* ANNUAL-specific fields — only shown in create mode */}
      {tier === 'ANNUAL' && !isEdit && (
        <>
          <FormInput
            label="Total cost"
            name="annualAmount"
            type="number"
            step="0.01"
            min="0.01"
            startAdornment="$"
            placeholder="0.00"
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <FormSelect label="Planned month" name="dueMonth" required>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </FormSelect>
            <FormSelect label="Due year" name="dueYear" required>
              {[currentYear, currentYear + 1, currentYear + 2].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </FormSelect>
          </div>
          <FormInput
            label="Already saved (optional)"
            name="funded"
            type="number"
            step="0.01"
            min="0"
            startAdornment="$"
            placeholder="0.00"
            defaultValue="0"
          />
          <div className="flex items-center gap-2">
            <input
              id="isRecurring"
              name="isRecurring"
              type="checkbox"
              value="true"
              className="h-4 w-4 rounded border-mist text-fjord"
            />
            <label htmlFor="isRecurring" className="text-sm text-fjord">
              Recurring annually
            </label>
          </div>
        </>
      )}

      {/* Category — shared */}
      <FormSelect label="Category (optional)" name="categoryId" defaultValue={initialBudget?.categoryId ?? autofill?.categoryId ?? ''}>
        <option value="">No category</option>
        {expenseCategories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </FormSelect>

      {/* Start date — shared (hidden in edit mode, not editable) */}
      {!isEdit && (
        <FormInput
          label="Start date"
          name="startDate"
          type="date"
          defaultValue={thisMonthStart}
          required
        />
      )}

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" loading={isPending || deleting} loadingText="Saving…">
          {isEdit ? 'Update budget' : 'Save budget'}
        </Button>
        <Button variant="secondary" href="/budgets">
          Cancel
        </Button>
        {isEdit && (
          <Button
            variant="danger"
            type="button"
            onClick={() => setDeleteOpen(true)}
            loading={deleting}
            loadingText="Deleting…"
            className="ml-auto"
          >
            Delete
          </Button>
        )}
      </div>

      <ConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete this budget?"
        description="This cannot be undone."
        confirmLabel="Delete"
        loading={deleting}
        variant="danger"
      />
    </form>
  )
}
