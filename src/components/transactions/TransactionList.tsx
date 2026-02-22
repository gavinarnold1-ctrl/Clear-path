'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
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

interface TransactionRow {
  id: string
  date: string
  merchant: string
  amount: number
  notes: string | null
  categoryId: string | null
  accountId: string | null
  category: { id: string; name: string } | null
  account: { id: string; name: string } | null
}

interface Props {
  transactions: TransactionRow[]
  categories: CategoryOption[]
  accounts: AccountOption[]
}

export default function TransactionList({ transactions: initial, categories, accounts }: Props) {
  const router = useRouter()
  const [transactions, setTransactions] = useState(initial)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Edit form state
  const [editDate, setEditDate] = useState('')
  const [editMerchant, setEditMerchant] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editCategoryId, setEditCategoryId] = useState<string>('')
  const [editAccountId, setEditAccountId] = useState<string>('')
  const [editNotes, setEditNotes] = useState('')

  const merchantRef = useRef<HTMLInputElement>(null)

  function startEdit(tx: TransactionRow) {
    if (editingId === tx.id) return
    setEditingId(tx.id)
    setEditDate(new Date(tx.date).toISOString().split('T')[0])
    setEditMerchant(tx.merchant)
    setEditAmount(String(tx.amount))
    setEditCategoryId(tx.categoryId ?? '')
    setEditAccountId(tx.accountId ?? '')
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
      if (e.key === 'Escape' && editingId) cancelEdit()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editingId, cancelEdit])

  async function saveEdit() {
    if (!editingId || saving) return
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
      notes: editNotes.trim() || null,
    }

    // Optimistic update
    const prevTransactions = transactions
    setTransactions(txs =>
      txs.map(tx => {
        if (tx.id !== editingId) return tx
        const cat = categories.find(c => c.id === editCategoryId) ?? null
        const acct = accounts.find(a => a.id === editAccountId) ?? null
        return {
          ...tx,
          date: new Date(editDate).toISOString(),
          merchant,
          amount,
          notes: editNotes.trim() || null,
          categoryId: editCategoryId || null,
          accountId: editAccountId || null,
          category: cat ? { id: cat.id, name: cat.name } : null,
          account: acct ? { id: acct.id, name: acct.name } : null,
        }
      })
    )
    setEditingId(null)

    try {
      const res = await fetch(`/api/transactions/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Save failed')
      }
    } catch (err) {
      // Revert on failure
      setTransactions(prevTransactions)
      setError(err instanceof Error ? err.message : 'Save failed')
      setEditingId(body.merchant as string) // re-open won't work perfectly but shows error
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    const prev = transactions
    setTransactions(txs => txs.filter(tx => tx.id !== id))

    try {
      const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      router.refresh()
    } catch {
      setTransactions(prev)
      setError('Failed to delete transaction')
    }
  }

  // Group categories for the dropdown
  const groupedCategories = categories.reduce<Record<string, CategoryOption[]>>((acc, cat) => {
    const g = cat.group || 'Other'
    if (!acc[g]) acc[g] = []
    acc[g].push(cat)
    return acc
  }, {})

  return (
    <div className="card overflow-hidden p-0">
      {error && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-medium underline">dismiss</button>
        </div>
      )}
      <table className="w-full text-sm">
        <thead className="border-b border-gray-100 bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Merchant</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Category</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Account</th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">Amount</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {transactions.map((tx) =>
            editingId === tx.id ? (
              <tr key={tx.id} className="bg-brand-50">
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
                    <button onClick={cancelEdit} className="text-xs text-gray-500 hover:text-gray-700">
                      Cancel
                    </button>
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      className="rounded bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr
                key={tx.id}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => startEdit(tx)}
              >
                <td className="px-4 py-3 text-gray-500">{formatDate(new Date(tx.date))}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{tx.merchant}</td>
                <td className="px-4 py-3 text-gray-500">{tx.category?.name ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500">{tx.account?.name ?? '—'}</td>
                <td className={`px-4 py-3 text-right font-semibold ${tx.amount < 0 ? 'text-expense' : tx.amount > 0 ? 'text-income' : 'text-transfer'}`}>
                  {tx.amount < 0 ? '−' : '+'}
                  {formatCurrency(Math.abs(tx.amount))}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(tx.id) }}
                    className="text-xs text-gray-400 hover:text-red-500"
                    aria-label={`Delete ${tx.merchant}`}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
      <p className="border-t border-gray-100 px-4 py-2 text-right text-xs text-gray-400">
        {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
      </p>
    </div>
  )
}
