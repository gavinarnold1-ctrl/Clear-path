'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { createAccount } from '@/app/actions/accounts'

const initialState = { error: null }

const ACCOUNT_TYPES = [
  { value: 'CHECKING', label: 'Checking' },
  { value: 'SAVINGS', label: 'Savings' },
  { value: 'CREDIT_CARD', label: 'Credit Card' },
  { value: 'INVESTMENT', label: 'Investment' },
  { value: 'CASH', label: 'Cash' },
]

export default function AccountForm() {
  const [state, formAction, isPending] = useActionState(createAccount, initialState)

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <p className="rounded-lg bg-ember/10 p-3 text-sm text-ember" role="alert">
          {state.error}
        </p>
      )}

      {/* Name */}
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-fjord">
          Account name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          className="input"
          placeholder="e.g. Main Checking, Emergency Fund"
          required
        />
      </div>

      {/* Type */}
      <div>
        <label htmlFor="type" className="mb-1 block text-sm font-medium text-fjord">
          Type
        </label>
        <select id="type" name="type" className="input" required>
          {ACCOUNT_TYPES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Starting balance */}
      <div>
        <label htmlFor="balance" className="mb-1 block text-sm font-medium text-fjord">
          Starting balance
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-stone">
            $
          </span>
          <input
            id="balance"
            name="balance"
            type="number"
            step="0.01"
            defaultValue="0"
            className="input pl-7"
          />
        </div>
        <p className="mt-1 text-xs text-stone">
          Use a negative value for credit cards with an existing balance.
        </p>
      </div>

      {/* Currency */}
      <div>
        <label htmlFor="currency" className="mb-1 block text-sm font-medium text-fjord">
          Currency
        </label>
        <input
          id="currency"
          name="currency"
          type="text"
          className="input"
          defaultValue="USD"
          maxLength={3}
          pattern="[A-Z]{3}"
          placeholder="USD"
        />
      </div>

      <div className="flex gap-3 pt-1">
        <button type="submit" className="btn-primary" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save account'}
        </button>
        <Link href="/accounts" className="btn-secondary">
          Cancel
        </Link>
      </div>
    </form>
  )
}
