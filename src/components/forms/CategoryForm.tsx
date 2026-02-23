'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { createCategory } from '@/app/actions/categories'

const initialState = { error: null }

export default function CategoryForm() {
  const [state, formAction, isPending] = useActionState(createCategory, initialState)

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <p className="rounded-lg bg-ember/10 p-3 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}

      {/* Name */}
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-fjord">
          Category name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          className="input"
          placeholder="e.g. Groceries, Salary, Transport"
          required
        />
      </div>

      {/* Type */}
      <div>
        <label htmlFor="type" className="mb-1 block text-sm font-medium text-fjord">
          Type
        </label>
        <select id="type" name="type" className="input" required>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
      </div>

      {/* Group */}
      <div>
        <label htmlFor="group" className="mb-1 block text-sm font-medium text-fjord">
          Group <span className="font-normal text-stone">(optional)</span>
        </label>
        <input
          id="group"
          name="group"
          type="text"
          className="input"
          placeholder="e.g. Food & Dining, Housing"
        />
      </div>

      {/* Icon (emoji shorthand) */}
      <div>
        <label htmlFor="icon" className="mb-1 block text-sm font-medium text-fjord">
          Icon <span className="font-normal text-stone">(optional — use an emoji)</span>
        </label>
        <input
          id="icon"
          name="icon"
          type="text"
          className="input"
          placeholder="🛒"
          maxLength={4}
        />
      </div>

      {/* Budget tier */}
      <div>
        <label htmlFor="budgetTier" className="mb-1 block text-sm font-medium text-fjord">
          Default budget tier <span className="font-normal text-stone">(optional)</span>
        </label>
        <select id="budgetTier" name="budgetTier" className="input">
          <option value="">None</option>
          <option value="FIXED">Fixed</option>
          <option value="FLEXIBLE">Flexible</option>
          <option value="ANNUAL">Annual</option>
        </select>
      </div>

      <div className="flex gap-3 pt-1">
        <button type="submit" className="btn-primary" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save category'}
        </button>
        <Link href="/categories" className="btn-secondary">
          Cancel
        </Link>
      </div>
    </form>
  )
}
