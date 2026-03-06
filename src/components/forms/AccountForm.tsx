'use client'

import { useActionState } from 'react'
import { createAccount } from '@/app/actions/accounts'
import { Button } from '@/components/ui/Button'
import { FormInput } from '@/components/ui/FormInput'
import { FormSelect } from '@/components/ui/FormSelect'

const initialState = { error: null }

const ACCOUNT_TYPES = [
  { value: 'CHECKING', label: 'Checking' },
  { value: 'SAVINGS', label: 'Savings' },
  { value: 'CREDIT_CARD', label: 'Credit Card' },
  { value: 'INVESTMENT', label: 'Investment' },
  { value: 'CASH', label: 'Cash' },
  { value: 'MORTGAGE', label: 'Mortgage' },
  { value: 'AUTO_LOAN', label: 'Auto Loan' },
  { value: 'STUDENT_LOAN', label: 'Student Loan' },
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

      <FormInput
        label="Account name"
        name="name"
        type="text"
        placeholder="e.g. Main Checking, Emergency Fund"
        required
      />

      <FormSelect label="Type" name="type" required>
        {ACCOUNT_TYPES.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </FormSelect>

      <FormInput
        label="Starting balance"
        name="balance"
        type="number"
        step="0.01"
        defaultValue="0"
        startAdornment="$"
        helperText="Use a negative value for credit cards with an existing balance."
      />

      <FormInput
        label="Balance as of date"
        name="balanceAsOfDate"
        type="date"
        helperText="Optional. If set, only transactions after this date adjust the balance. Useful when importing CSV data that starts mid-history."
      />

      <FormInput
        label="Currency"
        name="currency"
        type="text"
        defaultValue="USD"
        maxLength={3}
        pattern="[A-Z]{3}"
        placeholder="USD"
      />

      <div className="flex gap-3 pt-1">
        <Button type="submit" disabled={isPending} loading={isPending} loadingText="Saving…">
          Save account
        </Button>
        <Button variant="secondary" href="/accounts">
          Cancel
        </Button>
      </div>
    </form>
  )
}
