'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import Link from 'next/link'
import { createBudget } from '@/app/actions/budgets'

interface CategoryOption {
  id: string
  name: string
  type: string
}

interface Props {
  categories: CategoryOption[]
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

export default function BudgetForm({ categories }: Props) {
  const [state, formAction, isPending] = useActionState(createBudget, initialState)
  const [tier, setTier] = useState('FLEXIBLE')
  const expenseCategories = categories.filter((c) => c.type === 'expense')

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}

      {/* Tier selector */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">Budget type</label>
        <div className="grid grid-cols-3 gap-2">
          {TIERS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTier(t.value)}
              className={`rounded-lg border-2 p-3 text-left transition-colors ${
                tier === t.value
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className="text-sm font-semibold text-gray-900">{t.label}</p>
              <p className="mt-0.5 text-xs text-gray-500">{t.desc}</p>
            </button>
          ))}
        </div>
        <input type="hidden" name="tier" value={tier} />
      </div>

      {/* Name */}
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
          Budget name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          className="input"
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
          <label htmlFor="amount" className="mb-1 block text-sm font-medium text-gray-700">
            {tier === 'FIXED' ? 'Monthly amount' : 'Spending limit'}
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
              $
            </span>
            <input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              className="input pl-7"
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
              <label htmlFor="dueDay" className="mb-1 block text-sm font-medium text-gray-700">
                Due day <span className="font-normal text-gray-400">(1-31)</span>
              </label>
              <input
                id="dueDay"
                name="dueDay"
                type="number"
                min="1"
                max="31"
                className="input"
                placeholder="1"
              />
            </div>
            <div>
              <label htmlFor="varianceLimit" className="mb-1 block text-sm font-medium text-gray-700">
                Variance limit <span className="font-normal text-gray-400">($)</span>
              </label>
              <input
                id="varianceLimit"
                name="varianceLimit"
                type="number"
                step="0.01"
                min="0"
                className="input"
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
              className="h-4 w-4 rounded border-gray-300 text-brand-600"
            />
            <label htmlFor="isAutoPay" className="text-sm text-gray-700">
              Auto-pay enabled
            </label>
          </div>
        </>
      )}

      {/* FLEXIBLE-specific fields */}
      {tier === 'FLEXIBLE' && (
        <>
          <div>
            <label htmlFor="period" className="mb-1 block text-sm font-medium text-gray-700">
              Period
            </label>
            <select id="period" name="period" className="input" required>
              {PERIODS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="endDate" className="mb-1 block text-sm font-medium text-gray-700">
              End date <span className="font-normal text-gray-400">(optional — leave blank for rolling)</span>
            </label>
            <input id="endDate" name="endDate" type="date" className="input" />
          </div>
        </>
      )}

      {/* ANNUAL-specific fields */}
      {tier === 'ANNUAL' && (
        <>
          <div>
            <label htmlFor="annualAmount" className="mb-1 block text-sm font-medium text-gray-700">
              Total cost
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
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
              <label htmlFor="dueMonth" className="mb-1 block text-sm font-medium text-gray-700">
                Due month
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
              <label htmlFor="dueYear" className="mb-1 block text-sm font-medium text-gray-700">
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
            <label htmlFor="funded" className="mb-1 block text-sm font-medium text-gray-700">
              Already saved <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
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
              className="h-4 w-4 rounded border-gray-300 text-brand-600"
            />
            <label htmlFor="isRecurring" className="text-sm text-gray-700">
              Recurring annually
            </label>
          </div>
        </>
      )}

      {/* Category — shared */}
      <div>
        <label htmlFor="categoryId" className="mb-1 block text-sm font-medium text-gray-700">
          Category <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <select id="categoryId" name="categoryId" className="input">
          <option value="">No category</option>
          {expenseCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Start date — shared */}
      <div>
        <label htmlFor="startDate" className="mb-1 block text-sm font-medium text-gray-700">
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

      <div className="flex gap-3 pt-1">
        <button type="submit" className="btn-primary" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save budget'}
        </button>
        <Link href="/budgets" className="btn-secondary">
          Cancel
        </Link>
      </div>
    </form>
  )
}
