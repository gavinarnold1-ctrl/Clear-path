'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import { createTransaction } from '@/app/actions/transactions'
import { Button } from '@/components/ui/Button'
import { FormInput } from '@/components/ui/FormInput'
import { FormSelect } from '@/components/ui/FormSelect'
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
interface HouseholdMemberOption {
  id: string
  name: string
  isDefault: boolean
}
interface PropertyOption {
  id: string
  name: string
  isDefault: boolean
  groupId?: string | null
  splitPct?: number | null
  taxSchedule?: string | null
}

interface PropertyGroupOption {
  id: string
  name: string
  properties: Array<{ id: string; name: string; splitPct: number | null; taxSchedule: string | null }>
}

interface Props {
  accounts: AccountOption[]
  categories: CategoryOption[]
  householdMembers?: HouseholdMemberOption[]
  properties?: PropertyOption[]
  propertyGroups?: PropertyGroupOption[]
}

const initialState = { error: null }
const today = new Date().toISOString().split('T')[0]

export default function TransactionForm({ accounts, categories, householdMembers = [], properties = [], propertyGroups = [] }: Props) {
  const [state, formAction, isPending] = useActionState(createTransaction, initialState)

  const incomeCategories = categories.filter((c) => c.type === 'income')
  const expenseCategories = categories.filter((c) => c.type === 'expense')

  const defaultMember = householdMembers.find(m => m.isDefault)
  const defaultProperty = properties.find(p => p.isDefault)

  // Split toggle state
  const [selectedPropertyId, setSelectedPropertyId] = useState(defaultProperty?.id ?? '')
  const [splitEnabled, setSplitEnabled] = useState(false)
  const [splitAllocations, setSplitAllocations] = useState<Array<{ propertyId: string; percentage: number }>>([])
  const [amountStr, setAmountStr] = useState('')

  // Track whether a group is selected directly
  const [selectedGroupId, setSelectedGroupId] = useState('')

  // Find if selected property belongs to a group
  const selectedProp = properties.find(p => p.id === selectedPropertyId)
  const groupForProperty = selectedGroupId
    ? propertyGroups.find(g => g.id === selectedGroupId)
    : selectedProp?.groupId
      ? propertyGroups.find(g => g.id === selectedProp.groupId)
      : null

  function handlePropertyChange(value: string) {
    // Check if user selected a group (prefixed with "group:")
    if (value.startsWith('group:')) {
      const gId = value.slice(6)
      const group = propertyGroups.find(g => g.id === gId)
      if (group && group.properties.length > 0) {
        setSelectedGroupId(gId)
        // Set propertyId to first property for form submission fallback
        setSelectedPropertyId(group.properties[0].id)
        // Auto-enable split with group's default percentages (or equal split)
        const hasRules = group.properties.some(p => (p.splitPct ?? 0) > 0)
        const allocs = group.properties.map(p => ({
          propertyId: p.id,
          percentage: hasRules ? (p.splitPct ?? 0) : Math.round(100 / group.properties.length),
        }))
        setSplitAllocations(allocs)
        setSplitEnabled(true)
        return
      }
    }
    setSelectedGroupId('')
    setSelectedPropertyId(value)
    setSplitEnabled(false)
    setSplitAllocations([])
  }

  function enableSplit() {
    if (!groupForProperty) return
    // Initialize allocations from group's default split percentages
    const allocs = groupForProperty.properties.map(p => ({
      propertyId: p.id,
      percentage: p.splitPct ?? 0,
    }))
    setSplitAllocations(allocs)
    setSplitEnabled(true)
  }

  function disableSplit() {
    setSplitEnabled(false)
    setSplitAllocations([])
  }

  function updateAllocation(propertyId: string, pct: number) {
    setSplitAllocations(prev =>
      prev.map(a => a.propertyId === propertyId ? { ...a, percentage: pct } : a)
    )
  }

  const totalPct = splitAllocations.reduce((sum, a) => sum + a.percentage, 0)
  const parsedAmount = parseFloat(amountStr) || 0

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <p className="rounded-lg bg-ember/10 p-3 text-sm text-ember" role="alert">
          {state.error}
        </p>
      )}

      {/* Hidden field for split data */}
      {splitEnabled && splitAllocations.length > 0 && (
        <input type="hidden" name="splitAllocations" value={JSON.stringify(splitAllocations)} />
      )}

      {/* Amount */}
      <FormInput
        label="Amount"
        name="amount"
        type="number"
        step="0.01"
        min="0.01"
        placeholder="0.00"
        required
        value={amountStr}
        onChange={(e) => setAmountStr(e.target.value)}
        onFocus={(e) => e.target.select()}
        startAdornment="$"
        helperText="Enter a positive amount (minimum $0.01). The sign is set automatically by category."
      />

      {/* Merchant */}
      <FormInput
        label="Merchant"
        name="merchant"
        type="text"
        placeholder="e.g. Whole Foods, Employer Inc."
        required
      />

      {/* Date */}
      <FormInput
        label="Date"
        name="date"
        type="date"
        className="text-left"
        defaultValue={today}
        required
      />

      {/* Account */}
      <FormSelect label="Account (optional)" name="accountId">
        <option value="">No account</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </FormSelect>

      {/* Category */}
      <FormSelect label="Category (optional)" name="categoryId">
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
      </FormSelect>

      {/* Person (household member) */}
      {householdMembers.length > 0 && (
        <FormSelect
          label="Person (optional)"
          name="householdMemberId"
          defaultValue={defaultMember?.id ?? ''}
        >
          <option value="">No person</option>
          {householdMembers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </FormSelect>
      )}

      {/* Property */}
      {properties.length > 0 && (
        <div>
          <FormSelect
            label="Property (optional)"
            id="propertyId"
            name="propertyId"
            value={selectedGroupId ? `group:${selectedGroupId}` : selectedPropertyId}
            onChange={(e) => handlePropertyChange(e.target.value)}
          >
            <option value="">No property</option>
            {/* Property groups as selectable options (auto-split) */}
            {propertyGroups.length > 0 && (
              <optgroup label="Property Groups (auto-split)">
                {propertyGroups.map((group) => (
                  <option key={`group-${group.id}`} value={`group:${group.id}`}>
                    {group.name} ({group.properties.length} properties)
                  </option>
                ))}
              </optgroup>
            )}
            {/* Individual properties in groups */}
            {propertyGroups.map((group) => (
              <optgroup key={group.id} label={group.name}>
                {group.properties.map((gp) => {
                  const schedLabel = gp.taxSchedule === 'SCHEDULE_E' ? ' (Schedule E)' :
                    gp.taxSchedule === 'SCHEDULE_C' ? ' (Schedule C)' :
                      gp.taxSchedule === 'SCHEDULE_A' ? ' (Schedule A)' : ''
                  const fullProp = properties.find(p => p.id === gp.id)
                  return (
                    <option key={gp.id} value={gp.id}>
                      {fullProp?.name ?? gp.name}{schedLabel}
                    </option>
                  )
                })}
              </optgroup>
            ))}
            {/* Ungrouped properties */}
            {properties
              .filter((p) => !p.groupId || !propertyGroups.some(g => g.properties.some(gp => gp.id === p.id)))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </FormSelect>

          {/* Split toggle — shown when selected property belongs to a group */}
          {groupForProperty && (
            <div className="mt-3 rounded-lg border border-pine/20 bg-pine/5 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-fjord">Split across group</p>
                  <p className="text-xs text-stone">
                    {groupForProperty.name} — {groupForProperty.properties.length} properties
                  </p>
                </div>
                {!splitEnabled ? (
                  <button
                    type="button"
                    onClick={enableSplit}
                    className="rounded-button bg-pine/10 border border-pine/30 px-3 py-1 text-xs font-medium text-pine hover:bg-pine/20"
                  >
                    Enable Split
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={disableSplit}
                    className="rounded-button bg-ember/10 border border-ember/30 px-3 py-1 text-xs font-medium text-ember hover:bg-ember/20"
                  >
                    Disable Split
                  </button>
                )}
              </div>

              {splitEnabled && (
                <div className="mt-3 space-y-2">
                  {splitAllocations.map((alloc) => {
                    const prop = groupForProperty.properties.find(p => p.id === alloc.propertyId)
                    const allocAmount = parsedAmount > 0 ? (parsedAmount * alloc.percentage / 100) : 0
                    const isTaxDeductible = prop?.taxSchedule === 'SCHEDULE_E' || prop?.taxSchedule === 'SCHEDULE_C'
                    return (
                      <div key={alloc.propertyId} className="flex items-center gap-2">
                        <span className="flex-1 text-sm text-fjord">
                          {prop?.name ?? 'Unknown'}
                          {isTaxDeductible && (
                            <span
                              className="ml-1 rounded-badge bg-pine/10 border border-pine/30 px-1 py-0.5 text-[10px] font-medium text-pine"
                              title="Tax-relevant split. Note: mortgage splits include principal (not deductible) — actual deductible amount depends on amortization breakdown."
                            >
                              Tax*
                            </span>
                          )}
                        </span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={alloc.percentage}
                          onChange={(e) => updateAllocation(alloc.propertyId, parseFloat(e.target.value) || 0)}
                          onFocus={(e) => e.target.select()}
                          className="input w-20 text-right text-sm"
                        />
                        <span className="text-xs text-stone">%</span>
                        {parsedAmount > 0 && (
                          <span className="w-20 text-right text-xs font-mono text-stone">
                            ${allocAmount.toFixed(2)}
                          </span>
                        )}
                      </div>
                    )
                  })}
                  <div className="flex items-center justify-between border-t border-pine/20 pt-2">
                    <span className="text-xs font-medium text-fjord">Total</span>
                    <span className={`text-xs font-medium ${Math.abs(totalPct - 100) < 0.01 ? 'text-pine' : 'text-ember'}`}>
                      {totalPct.toFixed(1)}%
                      {Math.abs(totalPct - 100) >= 0.01 && ' (must be 100%)'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="mb-1 block text-sm font-medium text-fjord">
          Notes <span className="font-normal text-stone">(optional)</span>
        </label>
        <textarea id="notes" name="notes" className="input" rows={2} placeholder="Any extra details…" />
      </div>

      <div className="flex gap-3 pt-1">
        <Button type="submit" loading={isPending} loadingText="Saving…">
          Save transaction
        </Button>
        <Button variant="secondary" href="/transactions">
          Cancel
        </Button>
      </div>
    </form>
  )
}
