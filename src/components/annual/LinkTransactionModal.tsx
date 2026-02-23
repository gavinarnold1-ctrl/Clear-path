'use client'

import { useState, useEffect } from 'react'
import { formatCurrency } from '@/lib/utils'

interface Transaction {
  id: string
  date: string
  merchant: string
  amount: number
  category?: { name: string } | null
}

interface Props {
  expenseId: string
  expenseName: string
  isOpen: boolean
  onClose: () => void
  onLinked: () => void
}

export default function LinkTransactionModal({
  expenseId,
  expenseName,
  isOpen,
  onClose,
  onLinked,
}: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [linking, setLinking] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    fetch('/api/transactions?limit=100&sort=date&order=desc')
      .then((res) => res.json())
      .then((data) => {
        setTransactions(Array.isArray(data) ? data : data.transactions ?? [])
      })
      .catch(() => setTransactions([]))
      .finally(() => setLoading(false))
  }, [isOpen])

  if (!isOpen) return null

  const filtered = search
    ? transactions.filter(
        (tx) =>
          tx.merchant.toLowerCase().includes(search.toLowerCase()) ||
          tx.category?.name?.toLowerCase().includes(search.toLowerCase())
      )
    : transactions

  async function handleLink(transactionId: string) {
    setLinking(transactionId)
    try {
      const res = await fetch(`/api/budgets/annual/${expenseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'linkTransaction', transactionId }),
      })
      if (!res.ok) throw new Error('Failed to link')
      onLinked()
      onClose()
    } catch {
      // Keep modal open on error
    } finally {
      setLinking(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-100 p-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Link Transaction to {expenseName}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Select a transaction to apply toward this annual expense&apos;s funded amount.
          </p>
          <input
            type="text"
            placeholder="Search by merchant or category..."
            className="input mt-3 w-full text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {loading ? (
            <p className="py-6 text-center text-sm text-gray-400">Loading transactions...</p>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">No transactions found.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filtered.map((tx) => (
                <li key={tx.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{tx.merchant}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(tx.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                      {tx.category && ` \u00B7 ${tx.category.name}`}
                    </p>
                  </div>
                  <div className="ml-3 flex items-center gap-2">
                    <span className={`text-sm font-semibold ${tx.amount < 0 ? 'text-expense' : 'text-income'}`}>
                      {formatCurrency(Math.abs(tx.amount))}
                    </span>
                    <button
                      onClick={() => handleLink(tx.id)}
                      disabled={linking === tx.id}
                      className="rounded bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                    >
                      {linking === tx.id ? '...' : 'Link'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-gray-100 p-3 text-right">
          <button onClick={onClose} className="btn-secondary px-4 py-2 text-sm">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
