'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { createCategory } from '@/app/actions/categories'

const initialState = { error: null }

const PRESET_COLORS = [
  '#6366f1', // indigo
  '#22c55e', // green
  '#ef4444', // red
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#14b8a6', // teal
  '#f97316', // orange
  '#64748b', // slate
]

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
          <option value="EXPENSE">Expense</option>
          <option value="INCOME">Income</option>
        </select>
      </div>

      {/* Color */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">Color</label>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((color, i) => (
            <label key={color} className="cursor-pointer">
              <input
                type="radio"
                name="color"
                value={color}
                defaultChecked={i === 0}
                className="sr-only"
              />
              <span
                className="block h-8 w-8 rounded-full ring-2 ring-offset-2 ring-transparent has-[:checked]:ring-gray-800"
                style={{ backgroundColor: color }}
                aria-label={color}
              />
            </label>
          ))}
        </div>
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
