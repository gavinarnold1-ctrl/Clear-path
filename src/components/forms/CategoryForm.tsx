'use client'

import { useActionState } from 'react'
import { createCategory } from '@/app/actions/categories'
import { Button } from '@/components/ui/Button'
import { FormInput } from '@/components/ui/FormInput'
import { FormSelect } from '@/components/ui/FormSelect'

const initialState = { error: null }

export default function CategoryForm() {
  const [state, formAction, isPending] = useActionState(createCategory, initialState)

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <p className="rounded-lg bg-ember/10 p-3 text-sm text-ember" role="alert">
          {state.error}
        </p>
      )}

      <FormInput
        label="Category name"
        name="name"
        type="text"
        placeholder="e.g. Groceries, Salary, Transport"
        required
      />

      <FormSelect label="Type" name="type" required>
        <option value="expense">Expense</option>
        <option value="income">Income</option>
      </FormSelect>

      <FormInput
        label="Group (optional)"
        name="group"
        type="text"
        placeholder="e.g. Food & Dining, Housing"
      />

      <FormInput
        label="Icon (optional — use an emoji)"
        name="icon"
        type="text"
        placeholder="🛒"
        maxLength={4}
      />

      <FormSelect label="Default budget tier (optional)" name="budgetTier">
        <option value="">None</option>
        <option value="FIXED">Fixed</option>
        <option value="FLEXIBLE">Flexible</option>
        <option value="ANNUAL">Annual</option>
      </FormSelect>

      <div className="flex gap-3 pt-1">
        <Button type="submit" disabled={isPending} loading={isPending} loadingText="Saving…">
          Save category
        </Button>
        <Button variant="secondary" href="/categories">
          Cancel
        </Button>
      </div>
    </form>
  )
}
