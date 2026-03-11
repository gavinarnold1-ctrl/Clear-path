import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { recordInsightResponse } from '@/lib/ai-context'

const VALID_STATUSES = new Set(['active', 'dismissed', 'completed'])
const VALID_DISMISS_REASONS = new Set([
  'not_relevant',
  'already_doing',
  'too_hard',
  'disagree',
  'other',
  'auto_replaced',
])

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { status, dismissReason, completionNotes, rating, helpful, comment } = body

  if (!status || !VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  // Verify ownership
  const existing = await db.insight.findUnique({ where: { id, userId: session.userId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Build update data based on status
  const updateData: Record<string, unknown> = { status }

  if (status === 'dismissed' && dismissReason) {
    if (!VALID_DISMISS_REASONS.has(dismissReason)) {
      return NextResponse.json({ error: 'Invalid dismiss reason' }, { status: 400 })
    }
    updateData.dismissReason = dismissReason
  }

  if (status === 'completed' && completionNotes) {
    updateData.completionNotes = completionNotes.trim()
  }

  const insight = await db.insight.update({
    where: { id },
    data: updateData,
  })

  // Record AI context signal for insight engagement learning
  if (status === 'dismissed' && dismissReason !== 'auto_replaced') {
    recordInsightResponse(
      session.userId,
      existing.type,
      existing.title,
      'dismissed'
    ).catch(() => {})
  } else if (status === 'completed') {
    recordInsightResponse(
      session.userId,
      existing.type,
      existing.title,
      'acted_on'
    ).catch(() => {})
  }

  // Store feedback if provided (rating, helpful, comment)
  if (rating !== undefined || helpful !== undefined || comment !== undefined) {
    await db.insightFeedback.upsert({
      where: {
        insightId_userId: { insightId: id, userId: session.userId },
      },
      update: {
        ...(rating !== undefined && { rating }),
        ...(helpful !== undefined && { helpful }),
        ...(comment !== undefined && { comment: comment?.trim() || null }),
      },
      create: {
        insightId: id,
        userId: session.userId,
        rating: rating ?? null,
        helpful: helpful ?? null,
        comment: comment?.trim() || null,
      },
    })
  }

  return NextResponse.json(insight)
}
