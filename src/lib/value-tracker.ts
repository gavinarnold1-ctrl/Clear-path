/**
 * Value tracker — computes savings identified vs confirmed.
 *
 * "Identified" = total potential savings from AI insights.
 * "Confirmed" = savings from completed/actioned insights.
 */

interface InsightRow {
  status: string
  estimatedSavings: number | null
}

export interface ValueSummary {
  totalIdentified: number
  totalConfirmed: number
  insightsGenerated: number
  insightsActioned: number
}

export function computeValueSummary(insights: InsightRow[]): ValueSummary {
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
