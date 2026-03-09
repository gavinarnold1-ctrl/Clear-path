'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { trackInsightsGenerated } from '@/lib/analytics'

export default function GenerateButton({ hasTransactions }: { hasTransactions: boolean }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleGenerate() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/insights', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to generate insights')
        toast.error('Failed to generate review')
        return
      }
      trackInsightsGenerated(0, 'unknown')
      toast.success('Monthly review generated')
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
      toast.error('Failed to generate review')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {error && <p className="text-sm text-expense">{error}</p>}
      <Button
        type="button"
        onClick={handleGenerate}
        disabled={!hasTransactions}
        loading={loading}
        loadingText="Generating..."
      >
        Generate Review
      </Button>
    </div>
  )
}
