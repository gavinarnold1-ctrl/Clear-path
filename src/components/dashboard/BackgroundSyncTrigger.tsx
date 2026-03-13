'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface BackgroundSyncTriggerProps {
  staleItemIds: string[]
  allItemIds: string[]
  oldestSyncTime: string | null
  syncFailingAccountNames?: string[]
}

function formatRelativeTime(isoDate: string): string {
  const ms = Date.now() - new Date(isoDate).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function SyncIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
    </svg>
  )
}

export default function BackgroundSyncTrigger({ staleItemIds, allItemIds, oldestSyncTime, syncFailingAccountNames = [] }: BackgroundSyncTriggerProps) {
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle')
  const [manualSyncing, setManualSyncing] = useState(false)
  const [lastSynced, setLastSynced] = useState(oldestSyncTime)
  const [dismissedSyncBanner, setDismissedSyncBanner] = useState(false)

  // Background auto-sync for stale items — re-runs when staleItemIds change
  // (e.g. after data reset clears plaidLastSynced, dashboard recalculates staleness)
  const staleKey = staleItemIds.join(',')
  useEffect(() => {
    if (staleItemIds.length === 0 || status !== 'idle') return

    const syncStaleItems = async () => {
      setStatus('syncing')
      try {
        const response = await fetch('/api/plaid/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemIds: staleItemIds }),
        })

        if (response.ok) {
          const data = await response.json()
          if (data.balancesFailed > 0) {
            setStatus('error')
          } else {
            setStatus('done')
          }
          setLastSynced(new Date().toISOString())
          router.refresh()
        } else {
          setStatus('error')
        }
      } catch (error) {
        console.error('Background sync failed:', error)
        setStatus('error')
      }
    }

    syncStaleItems()
  }, [staleKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (status === 'done' || status === 'error') {
      const timer = setTimeout(() => setStatus('idle'), 3000)
      return () => clearTimeout(timer)
    }
  }, [status])

  async function handleSyncAll() {
    if (manualSyncing || allItemIds.length === 0) return
    setManualSyncing(true)
    try {
      const response = await fetch('/api/plaid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: allItemIds }),
      })
      if (response.ok) {
        const data = await response.json()
        if (data.balancesFailed > 0) {
          setStatus('error')
        } else {
          setStatus('done')
        }
        setLastSynced(new Date().toISOString())
        router.refresh()
      }
    } catch (error) {
      console.error('Manual sync failed:', error)
      setStatus('error')
    } finally {
      setManualSyncing(false)
    }
  }

  const syncing = status === 'syncing' || manualSyncing

  return (
    <>
      {/* Sync failure banner — shown when accounts have failed 3+ times in a row */}
      {syncFailingAccountNames.length > 0 && !dismissedSyncBanner && (
        <div className="mb-4 rounded-lg border border-ember/30 bg-ember/10 px-4 py-3 text-sm text-ember">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium">Bank sync is having trouble</p>
              <p className="mt-0.5 text-xs text-ember/80">
                {syncFailingAccountNames.length === 1
                  ? `${syncFailingAccountNames[0]} has failed to sync multiple times.`
                  : `${syncFailingAccountNames.length} accounts have failed to sync.`
                }
                {' '}Try reconnecting on the{' '}
                <a href="/accounts" className="font-medium underline">Accounts page</a>.
              </p>
            </div>
            <button
              onClick={() => setDismissedSyncBanner(true)}
              className="text-xs font-medium text-ember/60 hover:text-ember"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Sync button + last synced (only shown when Plaid accounts exist) */}
      {allItemIds.length > 0 && (
        <div className="mb-4 flex items-center justify-end gap-3">
          {lastSynced && (
            <span className="text-xs text-stone">
              Last synced {formatRelativeTime(lastSynced)}
            </span>
          )}
          <button
            onClick={handleSyncAll}
            disabled={syncing}
            className="flex items-center gap-1 text-xs font-medium text-stone transition-colors hover:text-fjord disabled:opacity-50"
          >
            <SyncIcon className={cn('h-3 w-3', syncing && 'animate-spin')} />
            {syncing ? 'Syncing…' : 'Sync accounts'}
          </button>
        </div>
      )}

      {/* Toast notifications */}
      {status === 'syncing' && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-fjord px-4 py-2 text-sm font-medium text-snow shadow-lg">
          <SyncIcon className="h-3.5 w-3.5 animate-spin" />
          Syncing accounts…
        </div>
      )}
      {status === 'done' && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-pine px-4 py-2 text-sm font-medium text-snow shadow-lg">
          Accounts updated
        </div>
      )}
      {status === 'error' && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-ember px-4 py-2 text-sm font-medium text-snow shadow-lg">
          Balance sync incomplete — try manual sync
        </div>
      )}
    </>
  )
}
