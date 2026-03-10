'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface BackgroundSyncTriggerProps {
  staleItemIds: string[]
}

export default function BackgroundSyncTrigger({ staleItemIds }: BackgroundSyncTriggerProps) {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    if (staleItemIds.length === 0 || syncing) return

    const syncStaleItems = async () => {
      setSyncing(true)
      try {
        const response = await fetch('/api/plaid/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemIds: staleItemIds }),
        })

        if (response.ok) {
          router.refresh()
        }
      } catch (error) {
        // Silent failure — user still has existing data
        console.error('Background sync failed:', error)
      } finally {
        setSyncing(false)
      }
    }

    syncStaleItems()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!syncing) return null

  return (
    <div className="mb-2 text-center text-xs text-stone">
      Refreshing your accounts...
    </div>
  )
}
