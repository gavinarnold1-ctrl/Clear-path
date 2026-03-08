import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getSession, setSession } from '@/lib/session'
import { db } from '@/lib/db'
import { incomeTransitionsArraySchema } from '@/lib/validation'

// GET current user profile
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, createdAt: true },
  })

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  return NextResponse.json(user, {
    headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=600' },
  })
}

// PATCH update name / email
export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, email, expectedMonthlyIncome, incomeTransitions } = body as {
    name?: string; email?: string; expectedMonthlyIncome?: number | null; incomeTransitions?: unknown
  }

  // Handle expectedMonthlyIncome update via UserProfile
  if (expectedMonthlyIncome !== undefined) {
    await db.userProfile.upsert({
      where: { userId: session.userId },
      create: { userId: session.userId, expectedMonthlyIncome: expectedMonthlyIncome },
      update: { expectedMonthlyIncome: expectedMonthlyIncome },
    })
    if (name === undefined && email === undefined && incomeTransitions === undefined) {
      return NextResponse.json({ success: true })
    }
  }

  // Handle incomeTransitions update via UserProfile
  if (incomeTransitions !== undefined) {
    const parsed = incomeTransitionsArraySchema.safeParse(incomeTransitions)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid income transitions data' }, { status: 400 })
    }
    await db.userProfile.upsert({
      where: { userId: session.userId },
      create: { userId: session.userId, incomeTransitions: parsed.data },
      update: { incomeTransitions: parsed.data.length > 0 ? parsed.data : Prisma.JsonNull },
    })
    if (name === undefined && email === undefined) {
      return NextResponse.json({ success: true })
    }
  }

  const updates: { name?: string | null; email?: string } = {}

  if (name !== undefined) {
    updates.name = name?.trim() || null
  }

  if (email !== undefined) {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) return NextResponse.json({ error: 'Email is required.' }, { status: 400 })

    // Check uniqueness
    const existing = await db.user.findUnique({ where: { email: trimmed } })
    if (existing && existing.id !== session.userId) {
      return NextResponse.json({ error: 'Email is already in use.' }, { status: 409 })
    }
    updates.email = trimmed
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update.' }, { status: 400 })
  }

  const user = await db.user.update({
    where: { id: session.userId },
    data: updates,
    select: { id: true, name: true, email: true, refreshTokenVersion: true },
  })

  // Refresh session with updated info
  await setSession({ userId: user.id, email: user.email, name: user.name }, user.refreshTokenVersion)

  return NextResponse.json(user)
}
