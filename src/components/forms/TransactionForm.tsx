'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { createTransaction } from '@/app/actions/transactions'
// Minimal prop shapes — compatible with Prisma results without unsafe casts
interface AccountOption {
  id: string
  name: string
}
interface CategoryOption {
  id: string
  name: string
  type: string
}

interface Props {
  accounts: AccountOption[]
  categories: CategoryOption[]
}

const initialState = { error: null }
const today = new Date().toISOString().split('T')[0]

export default function TransactionForm({ accounts, categories }: Props) {
  const [state, formAction, isPending] = useActionState(createTransaction, initialState)

  const incomeCategories = categories.filter((c) => c.type === 'income')
  const expenseCategories = categories.filter((c) => c.type === 'expense')

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}

      {/* Amount */}
      <div>
        <label htmlFor="amount" className="mb-1 block text-sm font-medium text-gray-700">
          Amount
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

      {/* Merchant */}
      <div>
        <label htmlFor="merchant" className="mb-1 block text-sm font-medium text-gray-700">
          Merchant
        </label>
        <input
          id="merchant"
          name="merchant"
          type="text"
          className="input"
          placeholder="e.g. Whole Foods, Employer Inc."
          required
        />
      </div>

      {/* Date */}
      <div>
        <label htmlFor="date" className="mb-1 block text-sm font-medium text-gray-700">
          Date
        </label>
        <input id="date" name="date" type="date" className="input" defaultValue={today} required />
      </div>

      {/* Account */}
      <div>
        <label htmlFor="accountId" className="mb-1 block text-sm font-medium text-gray-700">
          Account <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <select id="accountId" name="accountId" className="input">
          <option value="">No account</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
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
          <option value="">No category</option>
          {incomeCategories.length > 0 && (
            <optgroup label="Income">
              {incomeCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          )}
          {expenseCategories.length > 0 && (
            <optgroup label="Expense">
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="mb-1 block text-sm font-medium text-gray-700">
          Notes <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <textarea id="notes" name="notes" className="input" rows={2} placeholder="Any extra details…" />
      </div>

      <div className="flex gap-3 pt-1">
        <button type="submit" className="btn-primary" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save transaction'}
        </button>
        <Link href="/transactions" className="btn-secondary">
          Cancel
        </Link>
      </div>
    </form>
  )
}
