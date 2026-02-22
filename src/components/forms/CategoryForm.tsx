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
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}

      {/* Name */}
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
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
        <label htmlFor="type" className="mb-1 block text-sm font-medium text-gray-700">
          Type
        </label>
        <select id="type" name="type" className="input" required>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
      </div>

      {/* Group */}
      <div>
        <label htmlFor="group" className="mb-1 block text-sm font-medium text-gray-700">
          Group <span className="font-normal text-gray-400">(optional)</span>
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
        <label htmlFor="icon" className="mb-1 block text-sm font-medium text-gray-700">
          Icon <span className="font-normal text-gray-400">(optional — use an emoji)</span>
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
