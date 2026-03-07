import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getGeneration, clearGeneration } from '@/lib/budget-generation-store'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const record = getGeneration(session.userId)
  if (!record) {
    return NextResponse.json({ status: 'idle' })
  }

  if (record.status === 'complete') {
    // Clear after delivering so next poll returns idle
    clearGeneration(session.userId)
    return NextResponse.json({
      status: 'complete',
      proposal: record.proposal,
      profile: record.profile,
      goalContext: record.goalContext,
    })
  }

  if (record.status === 'error') {
    clearGeneration(session.userId)
    return NextResponse.json({ status: 'error', error: record.error })
  }

  return NextResponse.json({ status: 'pending' })
}
