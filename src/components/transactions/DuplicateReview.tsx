'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/Button'

interface DuplicateTx {
  id: string
  merchant: string
  amount: number
  date: string
  importSource: string | null
  categoryName: string | null
  accountName: string | null
  notes: string | null
  plaidTransactionId: string | null
  originalStatement: string | null
  isPending: boolean
}

interface DuplicateGroup {
  canonicalMerchant: string
  amount: number
  date: string
  dismissKey: string
  transactions: DuplicateTx[]
}

export default function DuplicateReview() {
  const router = useRouter()
  const [groups, setGroups] = useState<DuplicateGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [merging, setMerging] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dismissedAll, setDismissedAll] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/transactions/duplicates')
        if (!res.ok) throw new Error('Failed to load')
        const data = await res.json()
        setGroups(data.duplicateGroups ?? [])
      } catch {
        setError('Could not check for duplicates')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const dismissGroup = useCallback((group: DuplicateGroup) => {
    const key = group.dismissKey
    // Optimistic UI
    setDismissed(prev => {
      const next = new Set(prev)
      next.add(key)
      return next
    })
    // Persist server-side (fire-and-forget)
    fetch('/api/transactions/duplicates/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signature: key }),
    }).catch(() => { /* silently ignore */ })
  }, [])

  const visibleGroups = groups.filter(g => !dismissed.has(g.dismissKey))

  const dismissRemaining = useCallback(() => {
    const toDismiss = groups.filter(g => !dismissed.has(g.dismissKey))
    setDismissed(prev => {
      const next = new Set(prev)
      for (const g of toDismiss) {
        next.add(g.dismissKey)
        // Persist each server-side
        fetch('/api/transactions/duplicates/dismiss', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ signature: g.dismissKey }),
        }).catch(() => { /* silently ignore */ })
      }
      return next
    })
    setDismissedAll(true)
  }, [groups, dismissed])

  async function handleMerge(group: DuplicateGroup, keepId: string) {
    setMerging(keepId)
    setError(null)
    try {
      const deleteIds = group.transactions.filter(t => t.id !== keepId).map(t => t.id)
      const res = await fetch('/api/transactions/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keepId, deleteIds }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Merge failed')
      }
      setGroups(prev => prev.filter(g => g !== group))
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Merge failed')
    } finally {
      setMerging(null)
    }
  }

  if (loading || dismissedAll || visibleGroups.length === 0) return null

  return (
    <div className="rounded-card border border-birch/30 bg-birch/10 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-medium text-fjord">
            {visibleGroups.length} potential duplicate{visibleGroups.length !== 1 ? ' groups' : ''} found
          </h3>
          <p className="text-xs text-stone">
            Transactions with matching merchant, amount, and date from different sources.
          </p>
        </div>
        <button
          onClick={dismissRemaining}
          className="text-xs text-stone hover:text-fjord"
        >
          Dismiss remaining
        </button>
      </div>

      {error && (
        <p className="mb-2 text-sm text-ember">{error}</p>
      )}

      <div className="space-y-3">
        {visibleGroups.slice(0, 5).map((group) => (
          <div key={group.dismissKey} className="rounded-button border border-mist bg-snow p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-fjord">
                {group.canonicalMerchant} &middot; {formatCurrency(Math.abs(group.amount))} &middot; {group.date}
              </p>
              <button
                onClick={() => dismissGroup(group)}
                className="shrink-0 rounded-badge border border-mist px-2 py-0.5 text-[10px] text-stone hover:bg-frost hover:text-fjord"
              >
                Not a duplicate
              </button>
            </div>
            <div className="space-y-1.5">
              {group.transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="rounded-badge bg-mist/50 px-1.5 py-0.5 text-[10px] font-medium text-stone">
                        {tx.importSource ?? 'manual'}
                      </span>
                      {tx.plaidTransactionId && (
                        <span className="rounded-badge bg-pine/10 px-1.5 py-0.5 text-[10px] font-medium text-pine">
                          Plaid-verified
                        </span>
                      )}
                      <span className="text-fjord">{tx.merchant}</span>
                      {tx.isPending && (
                        <span className="rounded-badge bg-mist/40 px-1 py-0.5 text-[10px] text-stone">
                          pending
                        </span>
                      )}
                      <span className="text-stone">{formatDate(new Date(tx.date))}</span>
                      {tx.categoryName && (
                        <span className="text-stone">{tx.categoryName}</span>
                      )}
                      {tx.accountName && (
                        <span className="text-stone">({tx.accountName})</span>
                      )}
                    </div>
                    {tx.originalStatement && tx.originalStatement !== tx.merchant && (
                      <span className="pl-1 text-[10px] text-stone/70 italic">
                        {tx.originalStatement}
                      </span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleMerge(group, tx.id)}
                    disabled={merging !== null}
                    loading={merging === tx.id}
                    loadingText="Merging…"
                    className="!px-2 !py-1 !text-[10px]"
                  >
                    Keep
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ))}
        {visibleGroups.length > 5 && (
          <p className="text-xs text-stone">
            + {visibleGroups.length - 5} more group{visibleGroups.length - 5 !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  )
}
