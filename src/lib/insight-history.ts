import { db } from './db'

export interface InsightHistory {
  totalGenerated: number
  completed: number
  dismissed: number
  completionRate: number
  recentDismissals: { title: string; reason: string | null }[]
  recentCompletions: { title: string; notes: string | null }[]
  topDismissReasons: { reason: string; count: number }[]
  previousInsightTitles: string[]
}

export async function buildInsightHistory(userId: string): Promise<InsightHistory> {
  const [allInsights, recentDismissed, recentCompleted] = await Promise.all([
    db.insight.findMany({
      where: { userId },
      select: { status: true, dismissReason: true, title: true },
    }),
    db.insight.findMany({
      where: { userId, status: 'dismissed' },
      select: { title: true, dismissReason: true },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }),
    db.insight.findMany({
      where: { userId, status: 'completed' },
      select: { title: true, completionNotes: true },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }),
  ])

  const totalGenerated = allInsights.length
  const completed = allInsights.filter((i) => i.status === 'completed').length
  const dismissed = allInsights.filter((i) => i.status === 'dismissed').length

  // Count dismiss reasons
  const reasonCounts = new Map<string, number>()
  for (const i of allInsights) {
    if (i.dismissReason) {
      reasonCounts.set(i.dismissReason, (reasonCounts.get(i.dismissReason) ?? 0) + 1)
    }
  }
  const topDismissReasons = Array.from(reasonCounts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)

  // Previous insight titles to avoid duplicates
  const recentTitles = await db.insight.findMany({
    where: { userId },
    select: { title: true },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })

  return {
    totalGenerated,
    completed,
    dismissed,
    completionRate: totalGenerated > 0 ? Math.round((completed / totalGenerated) * 100) : 0,
    recentDismissals: recentDismissed.map((d) => ({
      title: d.title,
      reason: d.dismissReason,
    })),
    recentCompletions: recentCompleted.map((c) => ({
      title: c.title,
      notes: c.completionNotes,
    })),
    topDismissReasons,
    previousInsightTitles: recentTitles.map((t) => t.title),
  }
}
