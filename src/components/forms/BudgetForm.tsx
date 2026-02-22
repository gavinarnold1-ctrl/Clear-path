'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { createBudget } from '@/app/actions/budgets'
// Minimal prop shape — compatible with Prisma results without unsafe casts
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
  { value: 'fixed', label: 'Fixed' },
  { value: 'flexible', label: 'Flexible' },
  { value: 'annual', label: 'Annual' },
]

const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  .toISOString()
  .split('T')[0]

export default function BudgetForm({ categories }: Props) {
  const [state, formAction, isPending] = useActionState(createBudget, initialState)
  const expenseCategories = categories.filter((c) => c.type === 'EXPENSE')

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}

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
          placeholder="e.g. Grocery Budget, Dining Out"
          required
        />
      </div>

      {/* Amount */}
      <div>
        <label htmlFor="amount" className="mb-1 block text-sm font-medium text-gray-700">
          Spending limit
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

      {/* Tier */}
      <div>
        <label htmlFor="tier" className="mb-1 block text-sm font-medium text-gray-700">
          Tier
        </label>
        <select id="tier" name="tier" className="input" required>
          {TIERS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Category */}
      <div>
        <label htmlFor="categoryId" className="mb-1 block text-sm font-medium text-gray-700">
          Category <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <select id="categoryId" name="categoryId" className="input">
          <option value="">All expense categories</option>
          {expenseCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Start date */}
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

      {/* End date */}
      <div>
        <label htmlFor="endDate" className="mb-1 block text-sm font-medium text-gray-700">
          End date <span className="font-normal text-gray-400">(optional — leave blank for rolling)</span>
        </label>
        <input id="endDate" name="endDate" type="date" className="input" />
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
