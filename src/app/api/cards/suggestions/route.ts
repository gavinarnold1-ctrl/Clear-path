import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { identifyCardPrograms } from '@/lib/card-identification'
import { db } from '@/lib/db'

// GET /api/cards/suggestions — get card program suggestions for unidentified credit cards
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const suggestions = await identifyCardPrograms(session.userId)

  // Also return all available card programs for manual selection
  const programs = await db.cardProgram.findMany({
    where: { isActive: true },
    include: { benefits: { where: { isActive: true }, orderBy: { type: 'asc' } } },
    orderBy: [{ issuer: 'asc' }, { name: 'asc' }],
  })

  return NextResponse.json({ suggestions, programs })
}
