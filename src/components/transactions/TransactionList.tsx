'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency, formatDate } from '@/lib/utils'
import { trackTransactionsSorted, trackTransactionsSearched, trackTransactionUpdated, trackTransactionsFiltered } from '@/lib/analytics'

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
  isPending?: boolean
  tags?: string | null
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
  initialBudgetId?: string
  initialTier?: string
  initialCatchAll?: boolean
  initialBudgetName?: string
  refundedTxIds?: string[]
  initialTotal?: number
  isInsightView?: boolean
}

export default function TransactionList({ transactions: initial, categories, accounts, householdMembers = [], properties = [], propertyGroups = [], initialCategoryId = '', initialMonth = '', initialPersonId = '', initialPropertyId = '', initialAccountId = '', initialSearch = '', initialClassification = '', initialAnnualExpenseId = '', initialAnnualExpenseName = '', initialUncategorized = false, initialBudgetId = '', initialTier = '', initialCatchAll = false, initialBudgetName = '', refundedTxIds = [], initialTotal = 0, isInsightView = false }: Props) {
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
  const [budgetTxIds, setBudgetTxIds] = useState<Set<string> | null>(null)
  const [budgetFilterLoading, setBudgetFilterLoading] = useState(false)
  const [budgetName, setBudgetName] = useState<string>(initialBudgetName)
  const [perkExcludedCount, setPerkExcludedCount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Column header filter state
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [filterAmountMin, setFilterAmountMin] = useState('')
  const [filterAmountMax, setFilterAmountMax] = useState('')
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set())
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set())
  const [categorySearch, setCategorySearch] = useState('')
  const [accountSearch, setAccountSearch] = useState('')

  // Sort state
  const [sortColumn, setSortColumn] = useState<'date' | 'merchant' | 'category' | 'account' | 'amount'>('date')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

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

  // Quick-categorize confirmation toast
  const [quickCatToast, setQuickCatToast] = useState<string | null>(null)
  const quickCatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Split sub-row expansion state
  const [expandedSplitId, setExpandedSplitId] = useState<string | null>(null)

  // Mobile detail row expansion
  const [mobileDetailId, setMobileDetailId] = useState<string | null>(null)

  // Pagination state
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(initialTotal)
  const [loading, setLoading] = useState(false)
  const [debouncedSearch, setDebouncedSearch] = useState(searchText)
  const PAGE_SIZE = 50
  const isBudgetMode = !!(initialBudgetId || initialCatchAll)
  const isInitialMount = useRef(true)
  const fetchIdRef = useRef(0)

  const merchantRef = useRef<HTMLInputElement>(null)

  // Sync transactions when parent re-renders with new data
  useEffect(() => {
    setTransactions(initial)
    setTotalCount(initialTotal)
  }, [initial, initialTotal])

  // Track search with debounce
  useEffect(() => {
    if (!searchText) return
    const timeout = setTimeout(() => {
      const q = searchText.toLowerCase()
      const hasResults = transactions.some(tx =>
        tx.merchant.toLowerCase().includes(q) || tx.notes?.toLowerCase().includes(q)
      )
      trackTransactionsSearched(hasResults)
    }, 800)
    return () => clearTimeout(timeout)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText])

  // Fetch budget-specific transaction IDs when budgetId or catchAll is active
  useEffect(() => {
    if (!initialBudgetId && !initialCatchAll) return

    setBudgetFilterLoading(true)

    const url = initialBudgetId
      ? `/api/budgets/${initialBudgetId}/transactions?month=${filterMonth}`
      : `/api/budgets/catch-all/transactions?month=${filterMonth}`

    fetch(url)
      .then(res => res.json())
      .then(data => {
        setBudgetTxIds(new Set(data.transactionIds))
        if (data.budgetName && !initialBudgetName) setBudgetName(data.budgetName)
        setPerkExcludedCount(data.perkExcludedCount ?? 0)
        setBudgetFilterLoading(false)
      })
      .catch(() => setBudgetFilterLoading(false))
  }, [initialBudgetId, initialCatchAll, filterMonth, initialBudgetName])

  // Debounce search text for server-side filtering (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 300)
    return () => clearTimeout(timer)
  }, [searchText])

  // Compute filter hash to detect filter changes and reset page
  const filterHash = [
    sortColumn, sortDirection, filterCategoryId, filterMonth, filterAccountId,
    filterPersonId, filterPropertyId, filterClassification, debouncedSearch,
    filterDateFrom, filterDateTo, filterAmountMin, filterAmountMax,
    String(filterUncategorized), filterAnnualExpenseId,
  ].join('|')

  const prevFilterHash = useRef(filterHash)
  if (filterHash !== prevFilterHash.current) {
    prevFilterHash.current = filterHash
    if (page !== 0) setPage(0)
  }

  // Fetch paginated data from API when filters or page change
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    if (isBudgetMode) return

    const fetchId = ++fetchIdRef.current
    setLoading(true)

    const params = new URLSearchParams()
    params.set('limit', String(PAGE_SIZE))
    params.set('offset', String(page * PAGE_SIZE))
    if (sortColumn !== 'category' && sortColumn !== 'account') {
      params.set('sortBy', sortColumn)
      params.set('sortDir', sortDirection)
    }
    if (filterCategoryId) params.set('categoryId', filterCategoryId)
    if (filterMonth) params.set('month', filterMonth)
    if (filterAccountId) params.set('accountId', filterAccountId)
    if (filterPersonId) params.set('householdMemberId', filterPersonId)
    if (filterPropertyId && !filterPropertyId.startsWith('group:')) params.set('propertyId', filterPropertyId)
    if (filterClassification) params.set('classification', filterClassification)
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (filterDateFrom) params.set('dateFrom', filterDateFrom)
    if (filterDateTo) params.set('dateTo', filterDateTo)
    if (filterAmountMin) params.set('amountMin', filterAmountMin)
    if (filterAmountMax) params.set('amountMax', filterAmountMax)
    if (filterUncategorized) params.set('uncategorized', 'true')
    if (filterAnnualExpenseId) params.set('annualExpenseId', filterAnnualExpenseId)

    fetch(`/api/transactions?${params}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        if (fetchId !== fetchIdRef.current) return
        setTransactions(data.transactions)
        setTotalCount(data.total)
      })
      .catch(() => {})
      .finally(() => {
        if (fetchId === fetchIdRef.current) setLoading(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterHash, isBudgetMode])

  // Apply filters (declared early — used by selection helpers and render)
  const filteredTransactions = transactions.filter((tx) => {
    // Budget-specific filter: when active, only show transactions the API computed for this budget
    if (budgetTxIds !== null) {
      if (!budgetTxIds.has(tx.id)) return false
      // Still apply month filter for consistency
      if (filterMonth) {
        const txDate = new Date(tx.date)
        const txMonth = `${txDate.getUTCFullYear()}-${String(txDate.getUTCMonth() + 1).padStart(2, '0')}`
        if (txMonth !== filterMonth) return false
      }
      // Still apply search filter
      if (searchText) {
        const q = searchText.toLowerCase()
        const haystack = [tx.merchant, tx.category?.name, tx.account?.name, tx.notes].filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    }
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
      const txMonth = `${txDate.getUTCFullYear()}-${String(txDate.getUTCMonth() + 1).padStart(2, '0')}`
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
    // Date range filter
    if (filterDateFrom) {
      const txDateStr = new Date(tx.date).toISOString().split('T')[0]
      if (txDateStr < filterDateFrom) return false
    }
    if (filterDateTo) {
      const txDateStr = new Date(tx.date).toISOString().split('T')[0]
      if (txDateStr > filterDateTo) return false
    }
    // Amount range filter
    if (filterAmountMin) {
      if (tx.amount < parseFloat(filterAmountMin)) return false
    }
    if (filterAmountMax) {
      if (tx.amount > parseFloat(filterAmountMax)) return false
    }
    // Multi-select category filter
    if (selectedCategoryIds.size > 0) {
      if (!tx.categoryId || !selectedCategoryIds.has(tx.categoryId)) return false
    }
    // Multi-select account filter
    if (selectedAccountIds.size > 0) {
      if (!tx.accountId || !selectedAccountIds.has(tx.accountId)) return false
    }
    return true
  })

  // Sort filtered transactions
  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    const dir = sortDirection === 'asc' ? 1 : -1
    switch (sortColumn) {
      case 'date': return dir * (new Date(a.date).getTime() - new Date(b.date).getTime())
      case 'merchant': return dir * (a.merchant ?? '').localeCompare(b.merchant ?? '')
      case 'category': return dir * (a.category?.name ?? '').localeCompare(b.category?.name ?? '')
      case 'account': return dir * (a.account?.name ?? '').localeCompare(b.account?.name ?? '')
      case 'amount': return dir * (a.amount - b.amount)
      default: return 0
    }
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

  // Quick-categorize: assign a category to an uncategorized transaction without full edit mode
  async function quickCategorize(txId: string, categoryId: string) {
    const cat = categories.find(c => c.id === categoryId)
    if (!cat) return

    // Optimistic update
    setTransactions(txs =>
      txs.map(tx =>
        tx.id === txId
          ? { ...tx, categoryId, category: { id: cat.id, name: cat.name } }
          : tx
      )
    )

    // Show toast
    if (quickCatTimerRef.current) clearTimeout(quickCatTimerRef.current)
    setQuickCatToast(`Categorized as "${cat.name}"`)
    quickCatTimerRef.current = setTimeout(() => setQuickCatToast(null), 2500)

    try {
      const res = await fetch(`/api/transactions/${txId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId }),
      })
      if (!res.ok) {
        // Revert on failure
        setTransactions(txs =>
          txs.map(tx =>
            tx.id === txId
              ? { ...tx, categoryId: null, category: null }
              : tx
          )
        )
        setQuickCatToast(null)
      }
    } catch {
      // Revert on error
      setTransactions(txs =>
        txs.map(tx =>
          tx.id === txId
            ? { ...tx, categoryId: null, category: null }
            : tx
        )
      )
      setQuickCatToast(null)
    }
  }

  function handleSort(column: typeof sortColumn) {
    let newDirection: 'asc' | 'desc'
    if (sortColumn === column) {
      newDirection = sortDirection === 'asc' ? 'desc' : 'asc'
      setSortDirection(newDirection)
    } else {
      newDirection = column === 'amount' ? 'desc' : 'asc'
      setSortColumn(column)
      setSortDirection(newDirection)
    }
    trackTransactionsSorted(column, newDirection)
  }

  function toggleFilter(col: string) {
    setActiveFilter(prev => prev === col ? null : col)
  }

  function toggleCategoryFilter(catId: string) {
    setSelectedCategoryIds(prev => {
      const next = new Set(prev)
      if (next.has(catId)) next.delete(catId)
      else next.add(catId)
      return next
    })
  }

  function toggleAccountFilter(accId: string) {
    setSelectedAccountIds(prev => {
      const next = new Set(prev)
      if (next.has(accId)) next.delete(accId)
      else next.add(accId)
      return next
    })
  }

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

    // Resolve group: prefix to the first property in the group for split attribution
    let resolvedPropertyId: string | null = editPropertyId || null
    if (editPropertyId.startsWith('group:')) {
      const groupId = editPropertyId.slice(6)
      const group = propertyGroups.find(g => g.id === groupId)
      if (group && group.propertyIds.length > 0) {
        resolvedPropertyId = group.propertyIds[0]
      }
    }

    const body: Record<string, unknown> = {
      merchant,
      amount,
      date: editDate,
      categoryId: editCategoryId || null,
      accountId: editAccountId || null,
      householdMemberId: editHouseholdMemberId || null,
      propertyId: resolvedPropertyId,
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
    trackTransactionUpdated(Object.keys(body))

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

  // Category counts for filter popover
  const categoryCounts: Record<string, number> = {}
  for (const tx of transactions) {
    if (tx.categoryId) categoryCounts[tx.categoryId] = (categoryCounts[tx.categoryId] ?? 0) + 1
  }

  // Account counts for filter popover
  const accountCounts: Record<string, number> = {}
  for (const tx of transactions) {
    if (tx.accountId) accountCounts[tx.accountId] = (accountCounts[tx.accountId] ?? 0) + 1
  }

  // Filtered categories/accounts for search in popovers
  const filteredCategoryOptions = categories.filter(c =>
    !categorySearch || c.name.toLowerCase().includes(categorySearch.toLowerCase())
  )
  const filteredAccountOptions = accounts.filter(a =>
    !accountSearch || a.name.toLowerCase().includes(accountSearch.toLowerCase())
  )

  // Check if any column filter is active (for pills bar)
  const hasAnyFilter = !!(filterCategoryId || filterMonth || filterPersonId || filterPropertyId || filterAccountId || searchText || filterClassification || filterAnnualExpenseId || filterUncategorized || budgetTxIds !== null || filterDateFrom || filterDateTo || filterAmountMin || filterAmountMax || selectedCategoryIds.size > 0 || selectedAccountIds.size > 0)

  function clearAllFilters() {
    setFilterPropertyId(''); setFilterPersonId(''); setFilterCategoryId(''); setFilterMonth(''); setFilterAccountId(''); setSearchText(''); setFilterClassification(''); setFilterAnnualExpenseId(''); setFilterUncategorized(false); setBudgetTxIds(null); setBudgetName(''); setFilterDateFrom(''); setFilterDateTo(''); setFilterAmountMin(''); setFilterAmountMax(''); setSelectedCategoryIds(new Set()); setSelectedAccountIds(new Set())
  }

  // Active filter indicator for column headers
  const hasDateFilter = !!(filterDateFrom || filterDateTo || filterMonth)
  const hasMerchantFilter = !!searchText
  const hasCategoryFilter = !!(filterCategoryId || selectedCategoryIds.size > 0 || filterUncategorized)
  const hasAccountFilter = !!(filterAccountId || selectedAccountIds.size > 0)
  const hasPersonFilter = !!filterPersonId
  const hasPropertyFilter = !!filterPropertyId
  const hasAmountFilter = !!(filterAmountMin || filterAmountMax || filterClassification)

  return (
    <div className="relative pb-16">
      {/* Budget filter context header */}
      {(initialBudgetId || initialCatchAll) && (
        <div className="mb-4 flex items-center justify-between rounded-card border border-fjord/20 bg-fjord/5 px-4 py-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-fjord">
              {budgetName || (initialCatchAll ? 'Unallocated Flexible' : 'Budget')}
              {initialTier && (
                <span className="ml-2 rounded-badge bg-mist px-1.5 py-0.5 text-[10px] font-medium text-stone">
                  {initialTier.toLowerCase()}
                </span>
              )}
            </h2>
            <p className="text-sm text-stone">
              {budgetFilterLoading
                ? 'Loading budget transactions...'
                : filteredTransactions.length === 0
                  ? 'No transactions match this budget.'
                  : `${filteredTransactions.length} transaction${filteredTransactions.length !== 1 ? 's' : ''} · ${formatCurrency(Math.abs(filteredTransactions.reduce((sum, tx) => sum + tx.amount, 0)))} total`}
            </p>
            {perkExcludedCount > 0 && !budgetFilterLoading && (
              <p className="text-xs text-pine">
                {perkExcludedCount} transaction{perkExcludedCount !== 1 ? 's' : ''} excluded (covered by card perks)
              </p>
            )}
          </div>
          <a
            href="/transactions"
            className="text-xs text-stone hover:text-fjord"
          >
            Clear filter
          </a>
        </div>
      )}
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
      {/* Search input */}
      <div className="relative mb-3">
        <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search transactions..."
          className="input w-full pl-9 pr-8 text-sm"
        />
        {searchText && (
          <button
            onClick={() => setSearchText('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-stone hover:text-fjord"
            aria-label="Clear search"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Active filter pills */}
      {hasAnyFilter && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {filterMonth && (
            <FilterPill label={`Month: ${filterMonth}`} onRemove={() => setFilterMonth('')} />
          )}
          {filterDateFrom && (
            <FilterPill label={`From: ${filterDateFrom}`} onRemove={() => setFilterDateFrom('')} />
          )}
          {filterDateTo && (
            <FilterPill label={`To: ${filterDateTo}`} onRemove={() => setFilterDateTo('')} />
          )}
          {searchText && (
            <FilterPill label={`Search: ${searchText}`} onRemove={() => setSearchText('')} />
          )}
          {filterCategoryId && (
            <FilterPill label={`Category: ${categories.find(c => c.id === filterCategoryId)?.name ?? filterCategoryId}`} onRemove={() => setFilterCategoryId('')} />
          )}
          {selectedCategoryIds.size > 0 && (
            <FilterPill label={`${selectedCategoryIds.size} categories`} onRemove={() => setSelectedCategoryIds(new Set())} />
          )}
          {filterAccountId && (
            <FilterPill label={`Account: ${accounts.find(a => a.id === filterAccountId)?.name ?? filterAccountId}`} onRemove={() => setFilterAccountId('')} />
          )}
          {selectedAccountIds.size > 0 && (
            <FilterPill label={`${selectedAccountIds.size} accounts`} onRemove={() => setSelectedAccountIds(new Set())} />
          )}
          {filterPersonId && (
            <FilterPill label={`Person: ${filterPersonId === '__none__' ? 'None' : householdMembers.find(m => m.id === filterPersonId)?.name ?? filterPersonId}`} onRemove={() => setFilterPersonId('')} />
          )}
          {filterPropertyId && (
            <FilterPill label={`Property: ${filterPropertyId === '__none__' ? 'None' : filterPropertyId.startsWith('group:') ? propertyGroups.find(g => g.id === filterPropertyId.slice(6))?.name ?? 'Group' : properties.find(p => p.id === filterPropertyId)?.name ?? filterPropertyId}`} onRemove={() => setFilterPropertyId('')} />
          )}
          {filterAmountMin && (
            <FilterPill label={`Min: $${filterAmountMin}`} onRemove={() => setFilterAmountMin('')} />
          )}
          {filterAmountMax && (
            <FilterPill label={`Max: $${filterAmountMax}`} onRemove={() => setFilterAmountMax('')} />
          )}
          {filterClassification && (
            <FilterPill label={filterClassification === 'perk_reimbursement' ? 'Perk Credits' : filterClassification} onRemove={() => setFilterClassification('')} />
          )}
          {filterAnnualExpenseId && (
            <FilterPill label={`Annual Plan: ${initialAnnualExpenseName || 'Linked'}`} onRemove={() => setFilterAnnualExpenseId('')} />
          )}
          {filterUncategorized && (
            <FilterPill label="Needs category" onRemove={() => setFilterUncategorized(false)} />
          )}
          <button onClick={clearAllFilters} className="text-xs text-stone hover:text-fjord">
            Clear all
          </button>
        </div>
      )}

      {isInsightView && sortedTransactions.length >= 2 && (
        <div className="mb-4 rounded-card border border-ember/20 bg-ember/5 p-3">
          <p className="text-sm font-medium text-fjord">
            Potential duplicates detected
          </p>
          <p className="mt-1 text-xs text-stone">
            These transactions have the same amount on the same date from similar merchants.
            Review and delete the duplicate if confirmed.
          </p>
        </div>
      )}

      <div className="card relative overflow-hidden p-0">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-snow/60">
            <div className="flex items-center gap-2 rounded-card bg-frost px-4 py-2 shadow-sm">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-mist border-t-fjord" />
              <span className="text-xs text-stone">Loading...</span>
            </div>
          </div>
        )}
        {error && (
          <div className="border-b border-ember/30 bg-ember/10 px-4 py-2 text-sm text-ember">
            {error}
            <button onClick={() => setError(null)} className="ml-2 font-medium underline">dismiss</button>
          </div>
        )}
        {/* Mobile card list — replaces table on small screens */}
        <div className="divide-y divide-mist md:hidden">
          {sortedTransactions.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-stone">
              No transactions match the current filters.
            </div>
          )}
          {sortedTransactions.map((tx) => (
            <div
              key={tx.id}
              className={`flex items-start gap-3 px-4 py-3 ${selected.has(tx.id) ? 'bg-fjord/5' : ''} ${isInsightView ? 'border-l-2 border-l-ember bg-ember/5' : ''}`}
              onClick={() => setMobileDetailId(mobileDetailId === tx.id ? null : tx.id)}
            >
              <input
                type="checkbox"
                checked={selected.has(tx.id)}
                onChange={() => toggleSelect(tx.id)}
                onClick={(e) => e.stopPropagation()}
                className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-mist text-fjord accent-fjord"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-medium text-fjord text-sm">
                    {tx.merchant}
                    {tx.isPending && (
                      <span className="ml-1.5 rounded-badge bg-mist/40 px-1.5 py-0.5 text-[10px] font-medium text-stone">Pending</span>
                    )}
                    {tx.classification === 'perk_reimbursement' && (
                      <span className="ml-1.5 rounded-badge bg-pine/15 px-1.5 py-0.5 text-[10px] font-medium text-pine">Card Perk</span>
                    )}
                  </p>
                  <span className={`shrink-0 text-sm font-semibold ${tx.amount < 0 ? 'text-expense' : tx.amount > 0 ? 'text-income' : 'text-transfer'}`}>
                    {tx.amount < 0 ? '−' : '+'}{formatCurrency(Math.abs(tx.amount))}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-stone">
                  <span>{formatDate(new Date(tx.date))}</span>
                  {tx.category && (
                    <>
                      <span className="text-mist">&middot;</span>
                      <span className="truncate">{tx.category.name}</span>
                    </>
                  )}
                  {!tx.category && (
                    <>
                      <span className="text-mist">&middot;</span>
                      <span className="text-birch">Uncategorized</span>
                    </>
                  )}
                </div>
                {/* Expanded detail */}
                {mobileDetailId === tx.id && (
                  <div className="mt-2 space-y-1 text-xs" onClick={(e) => e.stopPropagation()}>
                    {tx.account && <div><span className="text-stone">Account:</span> <span className="text-fjord">{tx.account.name}</span></div>}
                    {!tx.category && (
                      <div>
                        <span className="text-stone">Category:</span>{' '}
                        <select
                          value=""
                          onChange={(e) => { if (e.target.value) quickCategorize(tx.id, e.target.value) }}
                          className="ml-1 rounded-badge border border-birch/40 bg-birch/10 px-1.5 py-0.5 text-xs text-stone"
                        >
                          <option value="">+ Assign</option>
                          {Object.entries(groupedCategories).map(([group, cats]) => (
                            <optgroup key={group} label={group}>
                              {cats.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                    )}
                    {tx.householdMember && <div><span className="text-stone">Person:</span> <span className="text-fjord">{tx.householdMember.name}</span></div>}
                    {tx.property && <div><span className="text-stone">Property:</span> <span className="text-fjord">{tx.property.name}</span></div>}
                    {tx.notes && <div><span className="text-stone">Notes:</span> <span className="text-fjord">{tx.notes}</span></div>}
                    {tx.splits && tx.splits.length > 0 && (
                      <div className="mt-1 rounded-button bg-frost/50 px-2 py-1.5">
                        <p className="mb-1 text-[10px] font-medium uppercase text-stone">Split Allocations</p>
                        {tx.splits.map((split) => (
                          <div key={split.id} className="flex items-center justify-between text-xs">
                            <span className="text-fjord">{split.property?.name ?? 'Unknown'}</span>
                            <span className={split.amount < 0 ? 'text-expense' : 'text-income'}>
                              {split.amount < 0 ? '−' : '+'}{formatCurrency(Math.abs(split.amount))}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => startEdit(tx)}
                        className="rounded-button bg-fjord px-3 py-1.5 text-xs font-medium text-snow"
                      >
                        Edit
                      </button>
                      {deleteConfirmId === tx.id ? (
                        <span className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => { handleDelete(tx.id); setDeleteConfirmId(null) }}
                            className="rounded-badge bg-ember px-2 py-1 text-[10px] font-medium text-snow"
                          >
                            Confirm Delete
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="text-xs text-stone hover:text-fjord"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(tx.id)}
                          className="rounded-button border border-mist px-3 py-1.5 text-xs text-stone hover:text-ember"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table — hidden on mobile */}
        <div className="hidden overflow-x-auto md:block">
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
              <ColumnHeader
                label="Date"
                column="date"
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={handleSort}
                hasFilter={hasDateFilter}
                isOpen={activeFilter === 'date'}
                onToggle={() => toggleFilter('date')}
              >
                <div className="p-3">
                  <p className="mb-2 text-xs font-medium text-fjord">Date Range</p>
                  <div className="flex gap-2">
                    <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="input text-xs" />
                    <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="input text-xs" />
                  </div>
                  <div className="mt-2">
                    <p className="mb-1 text-xs font-medium text-fjord">Month</p>
                    <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="input w-full text-xs">
                      <option value="">All Months</option>
                      {(() => {
                        const months = new Set<string>()
                        for (const tx of transactions) {
                          const d = new Date(tx.date)
                          months.add(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
                        }
                        return [...months].sort().reverse().map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))
                      })()}
                    </select>
                  </div>
                  <button onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); setFilterMonth('') }} className="mt-2 text-xs text-stone hover:text-fjord">Clear</button>
                </div>
              </ColumnHeader>
              <ColumnHeader
                label="Merchant"
                column="merchant"
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={handleSort}
                hasFilter={hasMerchantFilter}
                isOpen={activeFilter === 'merchant'}
                onToggle={() => toggleFilter('merchant')}
              >
                <div className="p-3">
                  <input type="text" value={searchText} onChange={(e) => setSearchText(e.target.value)} className="input text-xs" placeholder="Search merchant..." autoFocus />
                </div>
              </ColumnHeader>
              <ColumnHeader
                label="Category"
                column="category"
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={handleSort}
                hasFilter={hasCategoryFilter}
                isOpen={activeFilter === 'category'}
                onToggle={() => toggleFilter('category')}
              >
                <div className="p-3">
                  <input type="text" value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)} className="input mb-2 text-xs" placeholder="Search categories..." autoFocus />
                  <div className="max-h-48 overflow-y-auto">
                    {filteredCategoryOptions.map(cat => (
                      <label key={cat.id} className="flex items-center gap-2 rounded px-1 py-1 text-xs hover:bg-frost">
                        <input type="checkbox" checked={selectedCategoryIds.has(cat.id)} onChange={() => toggleCategoryFilter(cat.id)} className="rounded border-mist" />
                        {cat.name}
                        <span className="ml-auto text-stone">{categoryCounts[cat.id] ?? 0}</span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-2 flex justify-between">
                    <button onClick={() => setSelectedCategoryIds(new Set(categories.map(c => c.id)))} className="text-xs text-pine hover:underline">Select all</button>
                    <button onClick={() => { setSelectedCategoryIds(new Set()); setFilterCategoryId(''); setCategorySearch('') }} className="text-xs text-stone hover:text-fjord">Clear</button>
                  </div>
                </div>
              </ColumnHeader>
              <ColumnHeader
                label="Account"
                column="account"
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={handleSort}
                hasFilter={hasAccountFilter}
                isOpen={activeFilter === 'account'}
                onToggle={() => toggleFilter('account')}
                className="hidden md:table-cell"
              >
                <div className="p-3">
                  <input type="text" value={accountSearch} onChange={(e) => setAccountSearch(e.target.value)} className="input mb-2 text-xs" placeholder="Search accounts..." autoFocus />
                  <div className="max-h-48 overflow-y-auto">
                    {filteredAccountOptions.map(acct => (
                      <label key={acct.id} className="flex items-center gap-2 rounded px-1 py-1 text-xs hover:bg-frost">
                        <input type="checkbox" checked={selectedAccountIds.has(acct.id)} onChange={() => toggleAccountFilter(acct.id)} className="rounded border-mist" />
                        {acct.name}
                        <span className="ml-auto text-stone">{accountCounts[acct.id] ?? 0}</span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-2 flex justify-between">
                    <button onClick={() => setSelectedAccountIds(new Set(accounts.map(a => a.id)))} className="text-xs text-pine hover:underline">Select all</button>
                    <button onClick={() => { setSelectedAccountIds(new Set()); setFilterAccountId(''); setAccountSearch('') }} className="text-xs text-stone hover:text-fjord">Clear</button>
                  </div>
                </div>
              </ColumnHeader>
              {householdMembers.length > 0 && (
                <th className="group relative hidden px-4 py-3 text-left font-medium text-stone lg:table-cell">
                  <button onClick={() => toggleFilter('person')} className="flex items-center gap-1 text-xs uppercase tracking-wider hover:text-fjord">
                    Person
                    {hasPersonFilter && <span className="h-1.5 w-1.5 rounded-full bg-pine" />}
                    <span className="h-3 w-3 text-stone/50">&#x25BE;</span>
                  </button>
                  {activeFilter === 'person' && (
                    <ColumnFilterPopover onClose={() => setActiveFilter(null)}>
                      <div className="p-3">
                        <label className="flex items-center gap-2 rounded px-1 py-1 text-xs hover:bg-frost">
                          <input type="radio" name="person-filter" checked={!filterPersonId} onChange={() => setFilterPersonId('')} className="border-mist" />
                          All People
                        </label>
                        <label className="flex items-center gap-2 rounded px-1 py-1 text-xs hover:bg-frost">
                          <input type="radio" name="person-filter" checked={filterPersonId === '__none__'} onChange={() => setFilterPersonId('__none__')} className="border-mist" />
                          No Person
                        </label>
                        {householdMembers.map(m => (
                          <label key={m.id} className="flex items-center gap-2 rounded px-1 py-1 text-xs hover:bg-frost">
                            <input type="radio" name="person-filter" checked={filterPersonId === m.id} onChange={() => setFilterPersonId(m.id)} className="border-mist" />
                            {m.name}
                          </label>
                        ))}
                      </div>
                    </ColumnFilterPopover>
                  )}
                </th>
              )}
              {properties.length > 0 && (
                <th className="group relative hidden px-4 py-3 text-left font-medium text-stone lg:table-cell">
                  <button onClick={() => toggleFilter('property')} className="flex items-center gap-1 text-xs uppercase tracking-wider hover:text-fjord">
                    Property
                    {hasPropertyFilter && <span className="h-1.5 w-1.5 rounded-full bg-pine" />}
                    <span className="h-3 w-3 text-stone/50">&#x25BE;</span>
                  </button>
                  {activeFilter === 'property' && (
                    <ColumnFilterPopover onClose={() => setActiveFilter(null)}>
                      <div className="p-3">
                        <label className="flex items-center gap-2 rounded px-1 py-1 text-xs hover:bg-frost">
                          <input type="radio" name="property-filter" checked={!filterPropertyId} onChange={() => setFilterPropertyId('')} className="border-mist" />
                          All Properties
                        </label>
                        <label className="flex items-center gap-2 rounded px-1 py-1 text-xs hover:bg-frost">
                          <input type="radio" name="property-filter" checked={filterPropertyId === '__none__'} onChange={() => setFilterPropertyId('__none__')} className="border-mist" />
                          No Property
                        </label>
                        {propertyGroups.map(g => (
                          <label key={`group-${g.id}`} className="flex items-center gap-2 rounded px-1 py-1 text-xs hover:bg-frost">
                            <input type="radio" name="property-filter" checked={filterPropertyId === `group:${g.id}`} onChange={() => setFilterPropertyId(`group:${g.id}`)} className="border-mist" />
                            {g.name} (all units)
                          </label>
                        ))}
                        {properties.map(p => (
                          <label key={p.id} className="flex items-center gap-2 rounded px-1 py-1 text-xs hover:bg-frost">
                            <input type="radio" name="property-filter" checked={filterPropertyId === p.id} onChange={() => setFilterPropertyId(p.id)} className="border-mist" />
                            {p.name}
                          </label>
                        ))}
                        <button onClick={() => setFilterPropertyId('')} className="mt-2 text-xs text-stone hover:text-fjord">Clear</button>
                      </div>
                    </ColumnFilterPopover>
                  )}
                </th>
              )}
              <ColumnHeader
                label="Amount"
                column="amount"
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={handleSort}
                hasFilter={hasAmountFilter}
                isOpen={activeFilter === 'amount'}
                onToggle={() => toggleFilter('amount')}
                align="right"
              >
                <div className="p-3">
                  <p className="mb-2 text-xs font-medium text-fjord">Amount Range</p>
                  <div className="flex items-center gap-2">
                    <input type="number" value={filterAmountMin} onChange={(e) => setFilterAmountMin(e.target.value)} className="input w-24 text-xs" placeholder="Min" step="0.01" />
                    <span className="text-xs text-stone">to</span>
                    <input type="number" value={filterAmountMax} onChange={(e) => setFilterAmountMax(e.target.value)} className="input w-24 text-xs" placeholder="Max" step="0.01" />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button onClick={() => { setFilterAmountMin(''); setFilterAmountMax('-0.01'); setFilterClassification('') }} className="rounded bg-frost px-2 py-1 text-xs text-fjord hover:bg-mist">Expenses only</button>
                    <button onClick={() => { setFilterAmountMin('0.01'); setFilterAmountMax(''); setFilterClassification('') }} className="rounded bg-frost px-2 py-1 text-xs text-fjord hover:bg-mist">Income only</button>
                  </div>
                  <p className="mb-1 mt-3 text-xs font-medium text-fjord">Classification</p>
                  <div className="flex flex-wrap gap-2">
                    {['income', 'expense', 'transfer', 'perk_reimbursement'].map(cls => (
                      <button
                        key={cls}
                        onClick={() => setFilterClassification(filterClassification === cls ? '' : cls)}
                        className={`rounded px-2 py-1 text-xs ${filterClassification === cls ? 'bg-fjord text-snow' : 'bg-frost text-fjord hover:bg-mist'}`}
                      >
                        {cls === 'perk_reimbursement' ? 'Perk Credits' : cls.charAt(0).toUpperCase() + cls.slice(1)}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => { setFilterAmountMin(''); setFilterAmountMax(''); setFilterClassification('') }} className="mt-2 text-xs text-stone hover:text-fjord">Clear</button>
                </div>
              </ColumnHeader>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-mist">
            {sortedTransactions.length === 0 && (
              <tr>
                <td colSpan={6 + (householdMembers.length > 0 ? 1 : 0) + (properties.length > 0 ? 1 : 0)} className="px-4 py-8 text-center text-sm text-stone">
                  No transactions match the current filters.
                </td>
              </tr>
            )}
            {sortedTransactions.map((tx) =>
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
                  <td className="hidden px-4 py-2 md:table-cell">
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
                    <td className="hidden px-4 py-2 lg:table-cell">
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
                    <td className="hidden px-4 py-2 lg:table-cell">
                      <select
                        value={editPropertyId}
                        onChange={(e) => setEditPropertyId(e.target.value)}
                        className="input text-sm"
                      >
                        <option value="">— None —</option>
                        {propertyGroups.length > 0 && (
                          <optgroup label="Property Groups">
                            {propertyGroups.map(g => (
                              <option key={`group-${g.id}`} value={`group:${g.id}`}>
                                {g.name} (Split)
                              </option>
                            ))}
                          </optgroup>
                        )}
                        <optgroup label="Individual Properties">
                          {properties.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </optgroup>
                      </select>
                    </td>
                  )}
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
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
                  className={`cursor-pointer hover:bg-snow ${selected.has(tx.id) ? 'bg-fjord/5' : ''} ${isInsightView ? 'border-l-2 border-l-ember bg-ember/5' : ''}`}
                  onClick={(e) => {
                    // On small screens, toggle mobile detail instead of inline edit
                    if (window.innerWidth < 768) {
                      e.preventDefault()
                      setMobileDetailId(mobileDetailId === tx.id ? null : tx.id)
                    } else {
                      startEdit(tx)
                    }
                  }}
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
                    {tx.isPending && (
                      <span className="ml-1.5 rounded-badge bg-mist/40 px-1.5 py-0.5 text-[10px] font-medium text-stone">
                        Pending
                      </span>
                    )}
                    {tx.classification === 'perk_reimbursement' && (
                      <span className="ml-1.5 rounded-badge bg-pine/15 px-1.5 py-0.5 text-[10px] font-medium text-pine">
                        Card Perk
                      </span>
                    )}
                    {tx.tags?.includes('perk_covered') && (
                      <span className="ml-1.5 rounded-badge bg-lichen/20 px-1.5 py-0.5 text-[10px] font-medium text-pine">
                        Covered by perk
                      </span>
                    )}
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
                  <td className="px-4 py-3 text-stone" onClick={(e) => { if (!tx.categoryId) e.stopPropagation() }}>
                    {tx.category?.name ? (
                      tx.category.name
                    ) : (
                      <select
                        value=""
                        onChange={(e) => { if (e.target.value) quickCategorize(tx.id, e.target.value) }}
                        className="w-full max-w-[140px] rounded-badge border border-birch/40 bg-birch/10 px-1.5 py-0.5 text-xs text-stone hover:border-fjord/40 focus:border-fjord focus:outline-none"
                        title="Quick categorize"
                      >
                        <option value="">+ Category</option>
                        {Object.entries(groupedCategories).map(([group, cats]) => (
                          <optgroup key={group} label={group}>
                            {cats.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-stone md:table-cell">{tx.account?.name ?? '—'}</td>
                  {householdMembers.length > 0 && (
                    <td className="hidden px-4 py-3 text-stone lg:table-cell">{tx.householdMember?.name ?? '—'}</td>
                  )}
                  {properties.length > 0 && (
                    <td className="hidden px-4 py-3 text-stone lg:table-cell">{tx.property?.name ?? '—'}</td>
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
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {deleteConfirmId === tx.id ? (
                      <span className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => { handleDelete(tx.id); setDeleteConfirmId(null) }}
                          onTouchEnd={(e) => { e.preventDefault(); handleDelete(tx.id); setDeleteConfirmId(null) }}
                          className="rounded-badge bg-ember px-2 py-1 text-[10px] font-medium text-snow"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          onTouchEnd={(e) => { e.preventDefault(); setDeleteConfirmId(null) }}
                          className="text-xs text-stone hover:text-fjord"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(tx.id)}
                        onTouchEnd={(e) => { e.preventDefault(); setDeleteConfirmId(tx.id) }}
                        className="min-h-[44px] min-w-[44px] text-xs text-stone hover:text-ember md:min-h-0 md:min-w-0"
                        aria-label={`Delete ${tx.merchant}`}
                      >
                        Delete
                      </button>
                    )}
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
                {/* Mobile detail row — shows hidden columns on small screens */}
                {mobileDetailId === tx.id && (
                  <tr className="bg-frost/50 md:hidden">
                    <td colSpan={5} className="space-y-1 px-4 py-2 text-xs">
                      {tx.account && <div><span className="text-stone">Account:</span> <span className="text-fjord">{tx.account.name}</span></div>}
                      {tx.category ? (
                        <div><span className="text-stone">Category:</span> <span className="text-fjord">{tx.category.name}</span></div>
                      ) : (
                        <div>
                          <span className="text-stone">Category:</span>{' '}
                          <select
                            value=""
                            onChange={(e) => { if (e.target.value) quickCategorize(tx.id, e.target.value) }}
                            className="ml-1 rounded-badge border border-birch/40 bg-birch/10 px-1.5 py-0.5 text-xs text-stone"
                          >
                            <option value="">+ Assign</option>
                            {Object.entries(groupedCategories).map(([group, cats]) => (
                              <optgroup key={group} label={group}>
                                {cats.map(c => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </div>
                      )}
                      {tx.householdMember && <div><span className="text-stone">Person:</span> <span className="text-fjord">{tx.householdMember.name}</span></div>}
                      {tx.property && <div><span className="text-stone">Property:</span> <span className="text-fjord">{tx.property.name}</span></div>}
                      {tx.notes && <div><span className="text-stone">Notes:</span> <span className="text-fjord">{tx.notes}</span></div>}
                      <button
                        onClick={(e) => { e.stopPropagation(); startEdit(tx) }}
                        className="mt-1 rounded-button bg-fjord px-3 py-1.5 text-xs font-medium text-snow"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              )
            )}
          </tbody>
        </table>
        </div>
        <div className="flex items-center justify-between border-t border-mist px-4 py-2">
          <p className="text-xs text-stone">
            {selected.size > 0 && (
              <span className="mr-3 font-medium text-fjord">{selected.size} selected</span>
            )}
            {isBudgetMode
              ? (hasAnyFilter
                ? `${filteredTransactions.length} of ${transactions.length} transaction${transactions.length !== 1 ? 's' : ''}`
                : `${transactions.length} transaction${transactions.length !== 1 ? 's' : ''}`)
              : totalCount === 0
                ? 'No transactions'
                : `${page * PAGE_SIZE + 1}\u2013${Math.min((page + 1) * PAGE_SIZE, totalCount)} of ${totalCount}`}
          </p>
          {!isBudgetMode && totalCount > PAGE_SIZE && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0 || loading}
                className="rounded-button border border-mist bg-snow px-3 py-1 text-xs font-medium text-fjord hover:bg-frost disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-stone">
                Page {page + 1} of {Math.ceil(totalCount / PAGE_SIZE)}
              </span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={(page + 1) * PAGE_SIZE >= totalCount || loading}
                className="rounded-button border border-mist bg-snow px-3 py-1 text-xs font-medium text-fjord hover:bg-frost disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-midnight/50 p-0 md:items-center md:p-4">
          <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-card bg-frost p-6 shadow-xl md:max-w-md md:rounded-card">
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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-midnight/50 p-0 md:items-center md:p-4">
          <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-card bg-frost p-6 shadow-xl md:max-w-md md:rounded-card">
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

      {/* Quick-categorize toast */}
      {quickCatToast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-button bg-fjord px-4 py-2 text-sm font-medium text-snow shadow-lg">
          {quickCatToast}
        </div>
      )}
    </div>
  )
}

// ─── Helper components ──────────────────────────────────────────────────────

function ColumnFilterPopover({
  children,
  onClose,
}: {
  children: React.ReactNode
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-mist bg-snow shadow-lg"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  )
}

function ColumnHeader({
  label,
  column,
  sortColumn,
  sortDirection,
  onSort,
  hasFilter,
  isOpen,
  onToggle,
  children,
  align,
  className: extraClassName,
}: {
  label: string
  column: 'date' | 'merchant' | 'category' | 'account' | 'amount'
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  onSort: (col: 'date' | 'merchant' | 'category' | 'account' | 'amount') => void
  hasFilter: boolean
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
  align?: 'right'
  className?: string
}) {
  return (
    <th className={`group relative px-4 py-3 ${align === 'right' ? 'text-right' : 'text-left'} font-medium text-stone ${extraClassName ?? ''}`}>
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
        <button
          onClick={() => onSort(column)}
          className="flex items-center gap-0.5 text-xs uppercase tracking-wider hover:text-fjord"
        >
          {label}
          {sortColumn === column && (
            <span className="text-fjord">{sortDirection === 'asc' ? '\u2191' : '\u2193'}</span>
          )}
        </button>
        {hasFilter && <span className="h-1.5 w-1.5 rounded-full bg-pine" />}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle() }}
          className="h-3 w-3 text-stone/50 transition-colors hover:text-fjord"
          aria-label={`Filter by ${label}`}
        >
          &#x25BE;
        </button>
      </div>
      {isOpen && (
        <ColumnFilterPopover onClose={onToggle}>
          {children}
        </ColumnFilterPopover>
      )}
    </th>
  )
}

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-mist bg-frost px-3 py-1 text-xs font-medium text-fjord">
      {label}
      <button onClick={onRemove} className="ml-0.5 text-stone hover:text-fjord">&times;</button>
    </div>
  )
}
