'use client'

import { useState } from 'react'
import InsightCard from './InsightCard'

interface InsightData {
  id: string
  category: string
  type: string
  priority: string
  title: string
  description: string
  savingsAmount: number | null
  actionItems: string
  metadata: string | null
}

interface InsightsListProps {
  initialInsights: InsightData[]
}

export default function InsightsList({ initialInsights }: InsightsListProps) {
  const [insights, setInsights] = useState(initialInsights)

  function handleRemove(id: string) {
    setInsights((prev) => prev.filter((i) => i.id !== id))
  }

  if (insights.length === 0) {
    return (
      <div className="card text-center">
        <p className="text-sm text-gray-400">
          All insights have been addressed. Generate new insights to get fresh recommendations.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {insights.map((insight) => (
        <InsightCard
          key={insight.id}
          {...insight}
          onDismiss={handleRemove}
          onComplete={handleRemove}
        />
      ))}
    </div>
  )
}
