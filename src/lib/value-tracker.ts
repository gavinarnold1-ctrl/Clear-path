import { db } from './db'

/**
 * Pure utility: compute savings summary from a pre-fetched insight array.
 * Used when caller already has the data (e.g. from a larger query).
 */
interface InsightRow {
  status: string
  estimatedSavings: number | null
}

export interface PureValueSummary {
  totalIdentified: number
  totalConfirmed: number
  insightsGenerated: number
  insightsActioned: number
}

export function computeValueSummary(insights: InsightRow[]): PureValueSummary {
  let totalIdentified = 0
  let totalConfirmed = 0
  let insightsActioned = 0

  for (const insight of insights) {
    const savings = insight.estimatedSavings ?? 0
    if (savings > 0) {
      totalIdentified += savings
    }
    if (insight.status === 'completed' && savings > 0) {
      totalConfirmed += savings
      insightsActioned++
    }
  }

  return {
    totalIdentified: Math.round(totalIdentified * 100) / 100,
    totalConfirmed: Math.round(totalConfirmed * 100) / 100,
    insightsGenerated: insights.length,
    insightsActioned,
  }
}

/**
 * DB-backed: fetch and compute value summary for a user.
 * Used by dashboard and monthly-review pages.
 */
export interface ValueSummary {
  totalIdentified: number
  totalActioned: number
  insightCount: number
  since: Date | null
  monthlySubscriptionCost: number
  roi: number
}

export async function getValueSummary(userId: string): Promise<ValueSummary> {
  const insights = await db.insight.findMany({
    where: {
      userId,
      savingsAmount: { not: null, gt: 0 },
    },
    select: {
      savingsAmount: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  const totalIdentified = insights.reduce((sum: number, i: { savingsAmount: number | null }) => sum + (i.savingsAmount ?? 0), 0)
  const earliest = insights.length > 0 ? insights[0].createdAt : null
  const monthsActive = earliest
    ? Math.max(1, Math.ceil((Date.now() - earliest.getTime()) / (30 * 24 * 60 * 60 * 1000)))
    : 1
  const monthlyCost = 9.99
  const roi = totalIdentified / (monthsActive * monthlyCost)

  return {
    totalIdentified: Math.round(totalIdentified * 100) / 100,
    totalActioned: 0,
    insightCount: insights.length,
    since: earliest,
    monthlySubscriptionCost: monthlyCost,
    roi: Math.round(roi * 10) / 10,
  }
}
