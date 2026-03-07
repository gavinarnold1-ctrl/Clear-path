import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'

/**
 * POST /api/transactions/duplicates/dismiss
 * Appends a stable signature to the user's dismissedDuplicates list.
 */
export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { signature } = body as { signature: string }

  if (!signature || typeof signature !== 'string') {
    return NextResponse.json({ error: 'signature is required' }, { status: 400 })
  }

  const profile = await db.userProfile.findUnique({
    where: { userId: session.userId },
    select: { dismissedDuplicates: true },
  })

  const existing = Array.isArray(profile?.dismissedDuplicates)
    ? (profile.dismissedDuplicates as string[])
    : []

  // Deduplicate
  const updated = [...new Set([...existing, signature])]

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

  return NextResponse.json({ ok: true })
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
