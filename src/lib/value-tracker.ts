import { db } from './db'

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
