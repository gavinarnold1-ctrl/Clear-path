'use client'

import { useActionState, useState, useCallback } from 'react'
import { createCategory } from '@/app/actions/categories'
import { Button } from '@/components/ui/Button'
import { FormInput } from '@/components/ui/FormInput'
import { FormSelect } from '@/components/ui/FormSelect'
import { GROUP_NAMES, suggestGroup } from '@/lib/reference/category-groups'

const initialState = { error: null }

export default function CategoryForm() {
  const [state, formAction, isPending] = useActionState(createCategory, initialState)
  const [selectedGroup, setSelectedGroup] = useState('')
  const [selectedType, setSelectedType] = useState('expense')
  const [autoSuggested, setAutoSuggested] = useState(false)

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value.trim()
    if (name.length >= 3 && !selectedGroup) {
      const suggested = suggestGroup(name, selectedType)
      if (suggested !== 'Other') {
        setSelectedGroup(suggested)
        setAutoSuggested(true)
      }
    }
  }, [selectedGroup, selectedType])

  const handleGroupChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedGroup(e.target.value)
    setAutoSuggested(false)
  }, [])

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
        onChange={handleNameChange}
      />

      <FormSelect
        label="Type"
        name="type"
        required
        value={selectedType}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedType(e.target.value)}
      >
        <option value="expense">Expense</option>
        <option value="income">Income</option>
      </FormSelect>

      <div>
        <label htmlFor="group" className="mb-1 block text-sm font-medium text-fjord">
          Group
          {autoSuggested && (
            <span className="ml-2 text-xs font-normal text-pine">(auto-suggested)</span>
          )}
        </label>
        <select
          id="group"
          name="group"
          value={selectedGroup}
          onChange={handleGroupChange}
          className="input w-full"
        >
          <option value="">— Select group —</option>
          {GROUP_NAMES.map(g => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>

      <FormInput
        label="Icon (optional — use an emoji)"
        name="icon"
        type="text"
        placeholder=""
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
