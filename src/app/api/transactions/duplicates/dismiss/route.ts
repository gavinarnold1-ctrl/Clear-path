import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'

/**
 * POST /api/transactions/duplicates/dismiss
 * Appends one or many stable signatures to the user's dismissedDuplicates list.
 * Accepts { signature: string } for single dismiss or { signatures: string[] } for bulk dismiss.
 */
export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { signature, signatures } = body as { signature?: string; signatures?: string[] }

  // Support both single and bulk dismiss
  const toAdd: string[] = []
  if (signatures && Array.isArray(signatures)) {
    if (signatures.length > 200) {
      return NextResponse.json({ error: 'Maximum 200 signatures per request' }, { status: 400 })
    }
    toAdd.push(...signatures.filter(s => typeof s === 'string' && s.length > 0))
  } else if (signature && typeof signature === 'string') {
    toAdd.push(signature)
  }

  if (toAdd.length === 0) {
    return NextResponse.json({ error: 'signature or signatures[] is required' }, { status: 400 })
  }

  const profile = await db.userProfile.findUnique({
    where: { userId: session.userId },
    select: { dismissedDuplicates: true },
  })

  const existing = Array.isArray(profile?.dismissedDuplicates)
    ? (profile.dismissedDuplicates as string[])
    : []

  // Deduplicate
  const updated = [...new Set([...existing, ...toAdd])]

  await db.userProfile.upsert({
    where: { userId: session.userId },
    update: { dismissedDuplicates: updated },
    create: {
      userId: session.userId,
      onboardingCompleted: true,
      onboardingStep: 0,
      dismissedDuplicates: updated,
    },
  })

  return NextResponse.json({ ok: true, dismissed: toAdd.length })
}

/**
 * GET /api/transactions/duplicates/dismiss
 * Returns the user's dismissed duplicate signatures.
 */
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await db.userProfile.findUnique({
    where: { userId: session.userId },
    select: { dismissedDuplicates: true },
  })

  const dismissed = Array.isArray(profile?.dismissedDuplicates)
    ? (profile.dismissedDuplicates as string[])
    : []

  return NextResponse.json({ dismissed })
}
