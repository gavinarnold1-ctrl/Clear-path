import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { recordRecalibrationResponse, recordInsightResponse } from '@/lib/ai-context'

/**
 * POST /api/ai/context — Record AI learning signals from client components.
 * Accepts: { type: 'recalibration_dismissed' | 'recalibration_accepted' | 'insight_response', ... }
 */
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { type } = body as { type?: string }

  switch (type) {
    case 'recalibration_dismissed': {
      const { action } = body as { action?: string }
      if (action === 'extend_date' || action === 'increase_monthly' || action === 'reduce_target' || action === 'celebrate') {
        await recordRecalibrationResponse(session.userId, action, false)
      }
      break
    }

    case 'insight_response': {
      const { insightType, insightSummary, action } = body as {
        insightType?: string
        insightSummary?: string
        action?: 'dismissed' | 'acted_on'
      }
      if (insightType && insightSummary && action) {
        await recordInsightResponse(session.userId, insightType, insightSummary, action)
      }
      break
    }

    default:
      return NextResponse.json({ error: 'Unknown signal type' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
