'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
        return
      }
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {error && <p className="text-sm text-expense">{error}</p>}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading || !hasTransactions}
        className="btn-primary disabled:cursor-not-allowed"
      >
        {loading ? 'Generating...' : 'Generate Insights'}
      </button>
    </div>
  )
}
