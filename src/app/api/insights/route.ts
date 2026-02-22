import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { generateAndStoreInsights } from '@/lib/insights'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const insights = await db.insight.findMany({
    where: { userId: session.userId, status: 'active' },
    orderBy: [{ priority: 'asc' }, { savingsAmount: 'desc' }],
  })

  const latestScore = await db.efficiencyScore.findFirst({
    where: { userId: session.userId },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ insights, efficiencyScore: latestScore })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Basic rate limiting: 1 generation per user per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const recentInsight = await db.insight.findFirst({
    where: { userId: session.userId, generatedAt: { gte: oneHourAgo } },
  })

  if (recentInsight) {
    return NextResponse.json(
      { error: 'Insights were generated recently. Please wait before generating again.' },
      { status: 429 }
    )
  }

  try {
    const result = await generateAndStoreInsights(session.userId)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Insight generation failed:', error)
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 })
  }
}
