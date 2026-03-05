'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import Link from 'next/link'
import { createBudget, updateBudget } from '@/app/actions/budgets'

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

interface Props {
  categories: CategoryOption[]
  initialBudget?: InitialBudget
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

export default function BudgetForm({ categories, initialBudget }: Props) {
  const isEdit = !!initialBudget
  const action = isEdit ? updateBudget : createBudget
  const [state, formAction, isPending] = useActionState(action, initialState)
  const [tier, setTier] = useState(initialBudget?.tier ?? 'FLEXIBLE')
  const [deleting, setDeleting] = useState(false)
  const expenseCategories = categories.filter((c) => c.type === 'expense')

  async function handleDelete() {
    if (!initialBudget || !confirm('Delete this budget? This cannot be undone.')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/budgets/${initialBudget.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Failed to delete budget')
        setDeleting(false)
        return
      }
      window.location.href = '/budgets'
    } catch {
      alert('Failed to delete budget')
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
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-fjord">
          Budget name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          className="input"
          defaultValue={initialBudget?.name ?? ''}
          placeholder={
            tier === 'FIXED' ? 'e.g. Rent, Internet, Car Insurance'
            : tier === 'ANNUAL' ? 'e.g. Summer Vacation, Christmas Gifts'
            : 'e.g. Grocery Budget, Dining Out'
          }
          required
        />
      </div>

      {/* Amount — FIXED and FLEXIBLE */}
      {(tier === 'FIXED' || tier === 'FLEXIBLE') && (
        <div>
          <label htmlFor="amount" className="mb-1 block text-sm font-medium text-fjord">
            {tier === 'FIXED' ? 'Monthly amount' : 'Spending limit'}
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-stone">
              $
            </span>
            <input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              className="input pl-7"
              defaultValue={initialBudget?.amount ?? ''}
              placeholder="0.00"
              required
            />
          </div>
        </div>
      )}

      {/* FIXED-specific fields */}
      {tier === 'FIXED' && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="dueDay" className="mb-1 block text-sm font-medium text-fjord">
                Due day <span className="font-normal text-stone">(1-31)</span>
              </label>
              <input
                id="dueDay"
                name="dueDay"
                type="number"
                min="1"
                max="31"
                className="input"
                defaultValue={initialBudget?.dueDay ?? ''}
                placeholder="1"
              />
            </div>
            <div>
              <label htmlFor="varianceLimit" className="mb-1 block text-sm font-medium text-fjord">
                Variance limit <span className="font-normal text-stone">($)</span>
              </label>
              <input
                id="varianceLimit"
                name="varianceLimit"
                type="number"
                step="0.01"
                min="0"
                className="input"
                defaultValue={initialBudget?.varianceLimit ?? ''}
                placeholder="0.00"
              />
            </div>
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
          <div>
            <label htmlFor="period" className="mb-1 block text-sm font-medium text-fjord">
              Period
            </label>
            <select id="period" name="period" className="input" defaultValue={initialBudget?.period ?? 'MONTHLY'} required>
              {PERIODS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="endDate" className="mb-1 block text-sm font-medium text-fjord">
              End date <span className="font-normal text-stone">(optional — leave blank for rolling)</span>
            </label>
            <input
              id="endDate"
              name="endDate"
              type="date"
              className="input"
              defaultValue={initialBudget?.endDate ?? ''}
            />
          </div>
        </>
      )}

      {/* ANNUAL-specific fields — only shown in create mode */}
      {tier === 'ANNUAL' && !isEdit && (
        <>
          <div>
            <label htmlFor="annualAmount" className="mb-1 block text-sm font-medium text-fjord">
              Total cost
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-stone">
                $
              </span>
              <input
                id="annualAmount"
                name="annualAmount"
                type="number"
                step="0.01"
                min="0.01"
                className="input pl-7"
                placeholder="0.00"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="dueMonth" className="mb-1 block text-sm font-medium text-fjord">
                Planned month
              </label>
              <select id="dueMonth" name="dueMonth" className="input" required>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="dueYear" className="mb-1 block text-sm font-medium text-fjord">
                Due year
              </label>
              <select id="dueYear" name="dueYear" className="input" required>
                {[currentYear, currentYear + 1, currentYear + 2].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="funded" className="mb-1 block text-sm font-medium text-fjord">
              Already saved <span className="font-normal text-stone">(optional)</span>
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-stone">
                $
              </span>
              <input
                id="funded"
                name="funded"
                type="number"
                step="0.01"
                min="0"
                className="input pl-7"
                placeholder="0.00"
                defaultValue="0"
              />
            </div>
          </div>
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
      <div>
        <label htmlFor="categoryId" className="mb-1 block text-sm font-medium text-fjord">
          Category <span className="font-normal text-stone">(optional)</span>
        </label>
        <select id="categoryId" name="categoryId" className="input" defaultValue={initialBudget?.categoryId ?? ''}>
          <option value="">No category</option>
          {expenseCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Start date — shared (hidden in edit mode, not editable) */}
      {!isEdit && (
        <div>
          <label htmlFor="startDate" className="mb-1 block text-sm font-medium text-fjord">
            Start date
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            className="input"
            defaultValue={thisMonthStart}
            required
          />
        </div>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button type="submit" className="btn-primary" disabled={isPending || deleting}>
          {isPending ? 'Saving…' : isEdit ? 'Update budget' : 'Save budget'}
        </button>
        <Link href="/budgets" className="btn-secondary">
          Cancel
        </Link>
        {isEdit && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="btn-danger ml-auto disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        )}
      </div>
    </form>
  )
}
