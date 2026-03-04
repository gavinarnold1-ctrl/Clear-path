'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency, formatDate } from '@/lib/utils'

interface CategoryOption {
  id: string
  name: string
  group: string
  type: string
}

interface AccountOption {
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
  type: string
  isDefault: boolean
  groupId?: string | null
}

interface PropertyGroupOption {
  id: string
  name: string
  propertyIds: string[]
}

interface SplitRow {
  id: string
  propertyId: string
  amount: number
  property: { id: string; name: string; taxSchedule: string | null } | null
}

interface TransactionRow {
  id: string
  date: string
  merchant: string
  amount: number
  notes: string | null
  categoryId: string | null
  accountId: string | null
  householdMemberId: string | null
  propertyId: string | null
  category: { id: string; name: string } | null
  account: { id: string; name: string } | null
  householdMember: { id: string; name: string } | null
  property: { id: string; name: string } | null
  classification?: string
  annualExpenseId?: string | null
  splits?: SplitRow[]
}

interface Props {
  transactions: TransactionRow[]
  categories: CategoryOption[]
  accounts: AccountOption[]
  householdMembers?: HouseholdMemberOption[]
  properties?: PropertyOption[]
  propertyGroups?: PropertyGroupOption[]
  initialCategoryId?: string
  initialMonth?: string
  initialPersonId?: string
  initialPropertyId?: string
  initialAccountId?: string
  initialSearch?: string
  initialClassification?: string
  initialAnnualExpenseId?: string
  initialAnnualExpenseName?: string
  initialUncategorized?: boolean
  refundedTxIds?: string[]
}

export default function TransactionList({ transactions: initial, categories, accounts, householdMembers = [], properties = [], propertyGroups = [], initialCategoryId = '', initialMonth = '', initialPersonId = '', initialPropertyId = '', initialAccountId = '', initialSearch = '', initialClassification = '', initialAnnualExpenseId = '', initialAnnualExpenseName = '', initialUncategorized = false, refundedTxIds = [] }: Props) {
  const router = useRouter()
  const [transactions, setTransactions] = useState(initial)
  const [editingId, setEditingId] = useState<string | null>(null)
  const refundedSet = new Set(refundedTxIds)

  // Filter state (R4.4: property filter, R6.8: category + month filters, R3.3a: person filter)
  const [filterPropertyId, setFilterPropertyId] = useState<string>(initialPropertyId)
  const [filterPersonId, setFilterPersonId] = useState<string>(initialPersonId)
  const [filterCategoryId, setFilterCategoryId] = useState<string>(initialCategoryId)
  const [filterMonth, setFilterMonth] = useState<string>(initialMonth)
  const [filterAccountId, setFilterAccountId] = useState<string>(initialAccountId)
  const [searchText, setSearchText] = useState<string>(initialSearch)
  const [filterClassification, setFilterClassification] = useState<string>(initialClassification)
  const [filterUncategorized, setFilterUncategorized] = useState<boolean>(initialUncategorized)
  const [filterAnnualExpenseId, setFilterAnnualExpenseId] = useState<string>(initialAnnualExpenseId)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Edit form state
  const [editDate, setEditDate] = useState('')
  const [editMerchant, setEditMerchant] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editCategoryId, setEditCategoryId] = useState<string>('')
  const [editAccountId, setEditAccountId] = useState<string>('')
  const [editHouseholdMemberId, setEditHouseholdMemberId] = useState<string>('')
  const [editPropertyId, setEditPropertyId] = useState<string>('')
  const [editNotes, setEditNotes] = useState('')

  // Selection state
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Bulk edit modal state
  const [showBulkEdit, setShowBulkEdit] = useState(false)
  const [bulkApplyCategory, setBulkApplyCategory] = useState(false)
  const [bulkApplyAccount, setBulkApplyAccount] = useState(false)
  const [bulkApplyMerchant, setBulkApplyMerchant] = useState(false)
  const [bulkCategoryId, setBulkCategoryId] = useState<string>('')
  const [bulkAccountId, setBulkAccountId] = useState<string>('')
  const [bulkMerchant, setBulkMerchant] = useState('')
  const [bulkSaving, setBulkSaving] = useState(false)

  // Bulk delete confirmation state
  const [showBulkDelete, setShowBulkDelete] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // Split sub-row expansion state
  const [expandedSplitId, setExpandedSplitId] = useState<string | null>(null)

  const merchantRef = useRef<HTMLInputElement>(null)

  // Sync transactions when parent re-renders with new data
  useEffect(() => {
    setTransactions(initial)
  }, [initial])

  // Apply filters (declared early — used by selection helpers and render)
  const filteredTransactions = transactions.filter((tx) => {
    // Property filter (R4.4) — also match transactions with split allocations to this property
    // Supports group: prefix to filter by all properties in a PropertyGroup
    if (filterPropertyId) {
      if (filterPropertyId === '__none__') {
        if (tx.propertyId !== null) return false
      } else if (filterPropertyId.startsWith('group:')) {
        const groupId = filterPropertyId.slice(6)
        const group = propertyGroups.find(g => g.id === groupId)
        if (group) {
          const groupPropIds = new Set(group.propertyIds)
          const directMatch = tx.propertyId !== null && groupPropIds.has(tx.propertyId)
          const splitMatch = tx.splits?.some(s => groupPropIds.has(s.propertyId)) ?? false
          if (!directMatch && !splitMatch) return false
        }
      } else {
        const directMatch = tx.propertyId === filterPropertyId
        const splitMatch = tx.splits?.some(s => s.propertyId === filterPropertyId) ?? false
        if (!directMatch && !splitMatch) return false
      }
    }
    // Person filter (R3.3a)
    if (filterPersonId) {
      if (filterPersonId === '__none__' ? tx.householdMemberId !== null : tx.householdMemberId !== filterPersonId) return false
    }
    // Uncategorized filter — show only transactions with no category
    if (filterUncategorized) {
      if (tx.categoryId !== null) return false
    }
    // Category filter (R6.8)
    if (filterCategoryId) {
      if (tx.categoryId !== filterCategoryId) return false
    }
    // Month filter (R6.8)
    if (filterMonth) {
      const txDate = new Date(tx.date)
      const txMonth = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`
      if (txMonth !== filterMonth) return false
    }
    // Account filter
    if (filterAccountId) {
      if (filterAccountId === '__none__' ? tx.accountId !== null : tx.accountId !== filterAccountId) return false
    }
    // Annual expense filter (linked plan item)
    if (filterAnnualExpenseId) {
      if (tx.annualExpenseId !== filterAnnualExpenseId) return false
    }
    // Classification filter (income/expense/transfer)
    if (filterClassification) {
      if (tx.classification !== filterClassification) return false
    }
    // Search text filter (merchant, category name, notes)
    if (searchText) {
      const q = searchText.toLowerCase()
      const haystack = [tx.merchant, tx.category?.name, tx.account?.name, tx.notes].filter(Boolean).join(' ').toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })

  function startEdit(tx: TransactionRow) {
    if (editingId === tx.id) return
    setEditingId(tx.id)
    setEditDate(new Date(tx.date).toISOString().split('T')[0])
    setEditMerchant(tx.merchant)
    setEditAmount(String(Math.abs(tx.amount)))
    setEditCategoryId(tx.categoryId ?? '')
    setEditAccountId(tx.accountId ?? '')
    setEditHouseholdMemberId(tx.householdMemberId ?? '')
    setEditPropertyId(tx.propertyId ?? '')
    setEditNotes(tx.notes ?? '')
    setError(null)
  }

  useEffect(() => {
    if (editingId && merchantRef.current) {
      merchantRef.current.focus()
    }
  }, [editingId])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setError(null)
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (showBulkEdit) { setShowBulkEdit(false); return }
        if (showBulkDelete) { setShowBulkDelete(false); return }
        if (editingId) cancelEdit()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editingId, showBulkEdit, showBulkDelete, cancelEdit])

  async function saveEdit() {
    if (!editingId || saving) return
    const txId = editingId
    const merchant = editMerchant.trim()
    if (!merchant) { setError('Merchant is required.'); return }
    const amount = parseFloat(editAmount)
    if (isNaN(amount)) { setError('Amount must be a number.'); return }

    setSaving(true)
    setError(null)

    const body: Record<string, unknown> = {
      merchant,
      amount,
      date: editDate,
      categoryId: editCategoryId || null,
      accountId: editAccountId || null,
      householdMemberId: editHouseholdMemberId || null,
      propertyId: editPropertyId || null,
      notes: editNotes.trim() || null,
    }

    // Optimistic update
    const prevTransactions = transactions
    setTransactions(txs =>
      txs.map(tx => {
        if (tx.id !== txId) return tx
        const cat = categories.find(c => c.id === editCategoryId) ?? null
        const acct = accounts.find(a => a.id === editAccountId) ?? null
        const member = householdMembers.find(m => m.id === editHouseholdMemberId) ?? null
        const prop = properties.find(p => p.id === editPropertyId) ?? null
        return {
          ...tx,
          date: new Date(editDate).toISOString(),
          merchant,
          amount,
          notes: editNotes.trim() || null,
          categoryId: editCategoryId || null,
          accountId: editAccountId || null,
          householdMemberId: editHouseholdMemberId || null,
          propertyId: editPropertyId || null,
          category: cat ? { id: cat.id, name: cat.name } : null,
          account: acct ? { id: acct.id, name: acct.name } : null,
          householdMember: member ? { id: member.id, name: member.name } : null,
          property: prop ? { id: prop.id, name: prop.name } : null,
        }
      })
    )
    setEditingId(null)

    try {
      const res = await fetch(`/api/transactions/${txId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Save failed')
      }
      router.refresh()
    } catch (err) {
      setTransactions(prevTransactions)
      setEditingId(txId)
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    const prev = transactions
    setTransactions(txs => txs.filter(tx => tx.id !== id))
    setSelected(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })

    try {
      const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      router.refresh()
    } catch {
      setTransactions(prev)
      setError('Failed to delete transaction')
    }
  }

  // Selection helpers
  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    const allIds = filteredTransactions.map(tx => tx.id)
    const allChecked = allIds.length > 0 && allIds.every(id => selected.has(id))
    if (allChecked) {
      setSelected(new Set())
    } else {
      setSelected(new Set(allIds))
    }
  }

  function clearSelection() {
    setSelected(new Set())
  }

  const allSelected = filteredTransactions.length > 0 && filteredTransactions.every(tx => selected.has(tx.id))
  const someSelected = selected.size > 0 && !allSelected

  // Bulk edit handlers
  function openBulkEdit() {
    setBulkApplyCategory(false)
    setBulkApplyAccount(false)
    setBulkApplyMerchant(false)
    setBulkCategoryId('')
    setBulkAccountId('')
    setBulkMerchant('')
    setShowBulkEdit(true)
  }

  async function handleBulkEdit() {
    if (bulkSaving) return
    const updates: Record<string, unknown> = {}
    if (bulkApplyCategory) updates.categoryId = bulkCategoryId || null
    if (bulkApplyAccount) updates.accountId = bulkAccountId || null
    if (bulkApplyMerchant && bulkMerchant.trim()) updates.merchant = bulkMerchant.trim()

    if (Object.keys(updates).length === 0) {
      setError('Select at least one field to update.')
      return
    }

    setBulkSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/transactions/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionIds: [...selected],
          updates,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Bulk edit failed')
      }
      setShowBulkEdit(false)
      clearSelection()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk edit failed')
    } finally {
      setBulkSaving(false)
    }
  }

  // Bulk delete handlers
  async function handleBulkDelete() {
    if (bulkDeleting) return
    setBulkDeleting(true)
    setError(null)

    const prev = transactions
    setTransactions(txs => txs.filter(tx => !selected.has(tx.id)))

    try {
      const res = await fetch('/api/transactions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionIds: [...selected] }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Bulk delete failed')
      }
      setShowBulkDelete(false)
      clearSelection()
      router.refresh()
    } catch (err) {
      setTransactions(prev)
      setError(err instanceof Error ? err.message : 'Bulk delete failed')
    } finally {
      setBulkDeleting(false)
    }
  }

  // Preview for delete confirmation: first 5 selected transactions sorted by date
  const selectedTransactions = filteredTransactions
    .filter(tx => selected.has(tx.id))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  const deletePreview = selectedTransactions.slice(0, 5)
  const deleteOverflowCount = selectedTransactions.length - deletePreview.length

  // Group categories for the dropdown
  const groupedCategories = categories.reduce<Record<string, CategoryOption[]>>((acc, cat) => {
    const g = cat.group || 'Other'
    if (!acc[g]) acc[g] = []
    acc[g].push(cat)
    return acc
  }, {})

  return (
    <div className="relative pb-16">
      {/* Annual plan context header */}
      {filterAnnualExpenseId && (
        <div className="mb-4 rounded-card border border-pine/20 bg-pine/5 px-4 py-3">
          <h2 className="font-display text-lg font-semibold text-fjord">
            {initialAnnualExpenseName || 'Annual Plan'}
          </h2>
          <p className="text-sm text-stone">
            {filteredTransactions.length === 0
              ? 'No transactions linked to this plan yet. Use the annual planning page to link transactions.'
              : `${filteredTransactions.length} transaction${filteredTransactions.length !== 1 ? 's' : ''} linked to this annual plan`}
          </p>
        </div>
      )}
      {/* Filter bar (R4.4 + R6.8) */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-stone">Filter:</label>
        <select
          value={filterCategoryId}
          onChange={(e) => setFilterCategoryId(e.target.value)}
          className="input text-sm"
        >
          <option value="">All Categories</option>
          {Object.entries(groupedCategories).map(([group, cats]) => (
            <optgroup key={group} label={group}>
              {cats.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <select
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="input text-sm"
        >
          <option value="">All Months</option>
          {(() => {
            const months = new Set<string>()
            for (const tx of transactions) {
              const d = new Date(tx.date)
              months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
            }
            return [...months].sort().reverse().map(m => (
              <option key={m} value={m}>{m}</option>
            ))
          })()}
        </select>
        {householdMembers.length > 0 && (
          <select
            value={filterPersonId}
            onChange={(e) => setFilterPersonId(e.target.value)}
            className="input text-sm"
          >
            <option value="">All People</option>
            <option value="__none__">No Person</option>
            {householdMembers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        )}
        {accounts.length > 0 && (
          <select
            value={filterAccountId}
            onChange={(e) => setFilterAccountId(e.target.value)}
            className="input text-sm"
          >
            <option value="">All Accounts</option>
            <option value="__none__">No Account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        )}
        {properties.length > 0 && (
          <select
            value={filterPropertyId}
            onChange={(e) => setFilterPropertyId(e.target.value)}
            className="input text-sm"
          >
            <option value="">All Properties</option>
            <option value="__none__">No Property</option>
            {propertyGroups.length > 0 && (
              <optgroup label="Property Groups">
                {propertyGroups.map((g) => (
                  <option key={`group-${g.id}`} value={`group:${g.id}`}>
                    {g.name} (all units)
                  </option>
                ))}
              </optgroup>
            )}
            {properties.filter(p => !p.groupId).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
            {propertyGroups.map((g) => {
              const groupProps = properties.filter(p => g.propertyIds.includes(p.id))
              if (groupProps.length === 0) return null
              return (
                <optgroup key={g.id} label={g.name}>
                  {groupProps.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </optgroup>
              )
            })}
          </select>
        )}
        {searchText && (
          <div className="flex items-center gap-1 rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-midnight">
            Search: &quot;{searchText}&quot;
            <button onClick={() => setSearchText('')} className="ml-1 text-stone hover:text-fjord">&times;</button>
          </div>
        )}
        {filterClassification && (
          <div className="rounded-badge bg-frost px-2 py-0.5 text-xs text-fjord">
            {filterClassification}
            <button onClick={() => setFilterClassification('')} className="ml-1 text-stone hover:text-fjord">&times;</button>
          </div>
        )}
        {filterAnnualExpenseId && (
          <div className="flex items-center gap-1 rounded-full bg-pine/10 border border-pine/30 px-3 py-1 text-xs font-medium text-pine">
            Annual Plan: {initialAnnualExpenseName || 'Linked'}
            <button onClick={() => setFilterAnnualExpenseId('')} className="ml-1 text-stone hover:text-fjord">&times;</button>
          </div>
        )}
        {filterUncategorized && (
          <div className="flex items-center gap-1 rounded-full border border-birch/40 bg-birch/10 px-3 py-1 text-xs font-medium text-fjord">
            Needs category
            <button onClick={() => setFilterUncategorized(false)} className="ml-1 text-stone hover:text-fjord">&times;</button>
          </div>
        )}
        {(filterPropertyId || filterPersonId || filterCategoryId || filterMonth || filterAccountId || searchText || filterClassification || filterAnnualExpenseId || filterUncategorized) && (
          <button
            onClick={() => { setFilterPropertyId(''); setFilterPersonId(''); setFilterCategoryId(''); setFilterMonth(''); setFilterAccountId(''); setSearchText(''); setFilterClassification(''); setFilterAnnualExpenseId(''); setFilterUncategorized(false) }}
            className="text-xs text-stone hover:text-fjord"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="card overflow-hidden p-0">
        {error && (
          <div className="border-b border-ember/30 bg-ember/10 px-4 py-2 text-sm text-ember">
            {error}
            <button onClick={() => setError(null)} className="ml-2 font-medium underline">dismiss</button>
          </div>
        )}
        <table className="w-full text-sm">
          <thead className="border-b border-mist bg-snow">
            <tr>
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected }}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 cursor-pointer rounded border-mist text-fjord accent-fjord"
                  aria-label="Select all transactions"
                />
              </th>
              <th className="px-4 py-3 text-left font-medium text-stone">Date</th>
              <th className="px-4 py-3 text-left font-medium text-stone">Merchant</th>
              <th className="px-4 py-3 text-left font-medium text-stone">Category</th>
              <th className="px-4 py-3 text-left font-medium text-stone">Account</th>
              {householdMembers.length > 0 && (
                <th className="px-4 py-3 text-left font-medium text-stone">Person</th>
              )}
              {properties.length > 0 && (
                <th className="px-4 py-3 text-left font-medium text-stone">Property</th>
              )}
              <th className="px-4 py-3 text-right font-medium text-stone">Amount</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-mist">
            {filteredTransactions.map((tx) =>
              editingId === tx.id ? (
                <tr key={tx.id} className="bg-frost">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(tx.id)}
                      onChange={() => toggleSelect(tx.id)}
                      className="h-4 w-4 cursor-pointer rounded border-mist text-fjord accent-fjord"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="input text-sm"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      ref={merchantRef}
                      type="text"
                      value={editMerchant}
                      onChange={(e) => setEditMerchant(e.target.value)}
                      className="input text-sm"
                      onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={editCategoryId}
                      onChange={(e) => setEditCategoryId(e.target.value)}
                      className="input text-sm"
                    >
                      <option value="">— None —</option>
                      {Object.entries(groupedCategories).map(([group, cats]) => (
                        <optgroup key={group} label={group}>
                          {cats.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={editAccountId}
                      onChange={(e) => setEditAccountId(e.target.value)}
                      className="input text-sm"
                    >
                      <option value="">— None —</option>
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </td>
                  {householdMembers.length > 0 && (
                    <td className="px-4 py-2">
                      <select
                        value={editHouseholdMemberId}
                        onChange={(e) => setEditHouseholdMemberId(e.target.value)}
                        className="input text-sm"
                      >
                        <option value="">— None —</option>
                        {householdMembers.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </td>
                  )}
                  {properties.length > 0 && (
                    <td className="px-4 py-2">
                      <select
                        value={editPropertyId}
                        onChange={(e) => setEditPropertyId(e.target.value)}
                        className="input text-sm"
                      >
                        <option value="">— None —</option>
                        {properties.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </td>
                  )}
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      step="0.01"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="input text-right text-sm"
                      onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={cancelEdit} className="text-xs text-stone hover:text-fjord">
                        Cancel
                      </button>
                      <button
                        onClick={saveEdit}
                        disabled={saving}
                        className="rounded bg-fjord px-2 py-1 text-xs font-medium text-snow hover:bg-midnight disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <React.Fragment key={tx.id}>
                <tr
                  className={`cursor-pointer hover:bg-snow ${selected.has(tx.id) ? 'bg-fjord/5' : ''}`}
                  onClick={() => startEdit(tx)}
                >
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(tx.id)}
                      onChange={() => toggleSelect(tx.id)}
                      className="h-4 w-4 cursor-pointer rounded border-mist text-fjord accent-fjord"
                    />
                  </td>
                  <td className="px-4 py-3 text-stone">{formatDate(new Date(tx.date))}</td>
                  <td className="px-4 py-3 font-medium text-fjord">
                    {tx.merchant}
                    {refundedSet.has(tx.id) && (
                      <span className="ml-1.5 rounded-badge bg-birch/20 px-1.5 py-0.5 text-[10px] font-medium text-birch">
                        Refunded
                      </span>
                    )}
                    {tx.splits && tx.splits.length > 0 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setExpandedSplitId(expandedSplitId === tx.id ? null : tx.id) }}
                        className="ml-1.5 rounded-badge bg-pine/10 border border-pine/30 px-1.5 py-0.5 text-[10px] font-medium text-pine hover:bg-pine/20"
                        title="View split allocations"
                      >
                        Split {tx.splits.length}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-stone">{tx.category?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-stone">{tx.account?.name ?? '—'}</td>
                  {householdMembers.length > 0 && (
                    <td className="px-4 py-3 text-stone">{tx.householdMember?.name ?? '—'}</td>
                  )}
                  {properties.length > 0 && (
                    <td className="px-4 py-3 text-stone">{tx.property?.name ?? '—'}</td>
                  )}
                  <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${tx.amount < 0 ? 'text-expense' : tx.amount > 0 ? 'text-income' : 'text-transfer'}`}>
                    {(() => {
                      // When filtering by property, show the split amount if the match is via split
                      const splitForFilter = filterPropertyId && filterPropertyId !== '__none__' && tx.propertyId !== filterPropertyId
                        ? tx.splits?.find(s => s.propertyId === filterPropertyId)
                        : null
                      const displayAmount = splitForFilter ? splitForFilter.amount : tx.amount
                      return (
                        <>
                          {displayAmount < 0 ? '−' : '+'}
                          {formatCurrency(Math.abs(displayAmount))}
                          {splitForFilter && (
                            <span className="ml-1 text-[10px] font-normal text-stone">(split)</span>
                          )}
                        </>
                      )
                    })()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(tx.id) }}
                      className="text-xs text-stone hover:text-ember"
                      aria-label={`Delete ${tx.merchant}`}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
                {/* Split sub-rows */}
                {expandedSplitId === tx.id && tx.splits && tx.splits.length > 0 && (
                  tx.splits.map((split) => {
                    const pct = tx.amount !== 0 ? Math.abs((split.amount / tx.amount) * 100) : 0
                    return (
                      <tr key={split.id} className="bg-frost/50 border-t border-mist/50">
                        <td className="px-3 py-2" />
                        <td className="px-4 py-2" />
                        <td className="px-4 py-2 pl-8 text-xs text-stone" colSpan={2 + (householdMembers.length > 0 ? 1 : 0) + (properties.length > 0 ? 1 : 0)}>
                          <span className="font-medium text-fjord">{split.property?.name ?? 'Unknown'}</span>
                          <span className="ml-2 text-stone">{pct.toFixed(1)}%</span>
                        </td>
                        <td className={`whitespace-nowrap px-4 py-2 text-right text-xs font-medium ${split.amount < 0 ? 'text-expense' : split.amount > 0 ? 'text-income' : 'text-transfer'}`}>
                          {split.amount < 0 ? '−' : '+'}
                          {formatCurrency(Math.abs(split.amount))}
                        </td>
                        <td className="px-4 py-2" />
                      </tr>
                    )
                  })
                )}
                </React.Fragment>
              )
            )}
          </tbody>
        </table>
        <p className="border-t border-mist px-4 py-2 text-right text-xs text-stone">
          {selected.size > 0 && (
            <span className="mr-3 font-medium text-fjord">{selected.size} selected</span>
          )}
          {(filterPropertyId || filterPersonId || filterCategoryId || filterMonth || filterAccountId || searchText || filterClassification || filterAnnualExpenseId)
            ? `${filteredTransactions.length} of ${transactions.length} transaction${transactions.length !== 1 ? 's' : ''}`
            : `${transactions.length} transaction${transactions.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-midnight bg-fjord px-6 py-3 shadow-lg">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <span className="text-sm font-medium text-snow">
              {selected.size} transaction{selected.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={openBulkEdit}
                className="rounded-button bg-snow/15 px-4 py-1.5 text-sm font-medium text-snow hover:bg-snow/25"
              >
                Edit
              </button>
              <button
                onClick={() => setShowBulkDelete(true)}
                className="rounded-button bg-ember/80 px-4 py-1.5 text-sm font-medium text-snow hover:bg-ember"
              >
                Delete
              </button>
              <button
                onClick={clearSelection}
                className="px-3 py-1.5 text-sm text-snow/70 hover:text-snow"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk edit modal */}
      {showBulkEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/50 p-4">
          <div className="w-full max-w-md rounded-card bg-frost p-6 shadow-xl">
            <h2 className="mb-1 text-lg font-semibold text-fjord">
              Edit {selected.size} transaction{selected.size !== 1 ? 's' : ''}
            </h2>
            <p className="mb-5 text-sm text-stone">
              Check the fields you want to change. Unchecked fields will remain unchanged.
            </p>

            <div className="space-y-4">
              {/* Category field */}
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="bulk-apply-category"
                  checked={bulkApplyCategory}
                  onChange={(e) => setBulkApplyCategory(e.target.checked)}
                  className="mt-2 h-4 w-4 cursor-pointer rounded border-mist text-fjord accent-fjord"
                />
                <div className="flex-1">
                  <label htmlFor="bulk-apply-category" className="mb-1 block text-sm font-medium text-fjord">
                    Category
                  </label>
                  <select
                    value={bulkCategoryId}
                    onChange={(e) => { setBulkCategoryId(e.target.value); setBulkApplyCategory(true) }}
                    disabled={!bulkApplyCategory}
                    className="input text-sm disabled:opacity-50"
                  >
                    <option value="">— None —</option>
                    {Object.entries(groupedCategories).map(([group, cats]) => (
                      <optgroup key={group} label={group}>
                        {cats.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>

              {/* Account field */}
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="bulk-apply-account"
                  checked={bulkApplyAccount}
                  onChange={(e) => setBulkApplyAccount(e.target.checked)}
                  className="mt-2 h-4 w-4 cursor-pointer rounded border-mist text-fjord accent-fjord"
                />
                <div className="flex-1">
                  <label htmlFor="bulk-apply-account" className="mb-1 block text-sm font-medium text-fjord">
                    Account
                  </label>
                  <select
                    value={bulkAccountId}
                    onChange={(e) => { setBulkAccountId(e.target.value); setBulkApplyAccount(true) }}
                    disabled={!bulkApplyAccount}
                    className="input text-sm disabled:opacity-50"
                  >
                    <option value="">— None —</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Merchant field */}
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="bulk-apply-merchant"
                  checked={bulkApplyMerchant}
                  onChange={(e) => setBulkApplyMerchant(e.target.checked)}
                  className="mt-2 h-4 w-4 cursor-pointer rounded border-mist text-fjord accent-fjord"
                />
                <div className="flex-1">
                  <label htmlFor="bulk-apply-merchant" className="mb-1 block text-sm font-medium text-fjord">
                    Merchant / Description
                  </label>
                  <input
                    type="text"
                    value={bulkMerchant}
                    onChange={(e) => { setBulkMerchant(e.target.value); setBulkApplyMerchant(true) }}
                    disabled={!bulkApplyMerchant}
                    placeholder="Enter new merchant name"
                    className="input text-sm disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowBulkEdit(false)}
                className="px-4 py-2 text-sm text-stone hover:text-fjord"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkEdit}
                disabled={bulkSaving || (!bulkApplyCategory && !bulkApplyAccount && !bulkApplyMerchant)}
                className="rounded-button bg-fjord px-4 py-2 text-sm font-medium text-snow hover:bg-midnight disabled:opacity-50"
              >
                {bulkSaving ? 'Applying...' : 'Apply Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk delete confirmation */}
      {showBulkDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/50 p-4">
          <div className="w-full max-w-md rounded-card bg-frost p-6 shadow-xl">
            <h2 className="mb-1 text-lg font-semibold text-fjord">
              Delete {selected.size} transaction{selected.size !== 1 ? 's' : ''}?
            </h2>
            <p className="mb-4 text-sm text-stone">
              This cannot be undone. The following transactions will be permanently deleted:
            </p>

            <div className="mb-4 rounded-lg border border-mist bg-snow p-3">
              {deletePreview.map(tx => (
                <div key={tx.id} className="flex items-center justify-between py-1.5 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-stone">{formatDate(new Date(tx.date))}</span>
                    <span className="font-medium text-fjord">{tx.merchant}</span>
                  </div>
                  <span className={`whitespace-nowrap font-mono text-sm ${tx.amount < 0 ? 'text-expense' : 'text-income'}`}>
                    {tx.amount < 0 ? '−' : '+'}
                    {formatCurrency(Math.abs(tx.amount))}
                  </span>
                </div>
              ))}
              {deleteOverflowCount > 0 && (
                <p className="mt-1 border-t border-mist pt-2 text-xs text-stone">
                  + {deleteOverflowCount} more transaction{deleteOverflowCount !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowBulkDelete(false)}
                className="px-4 py-2 text-sm text-stone hover:text-fjord"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="rounded-button bg-ember px-4 py-2 text-sm font-medium text-snow hover:bg-ember/80 disabled:opacity-50"
              >
                {bulkDeleting ? 'Deleting...' : `Delete ${selected.size} Transaction${selected.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
