import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import type { PrimaryGoal } from '@/types'

const VALID_GOALS: PrimaryGoal[] = [
  'save_more',
  'spend_smarter',
  'pay_off_debt',
  'gain_visibility',
  'build_wealth',
]

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { primaryGoal } = body as { primaryGoal?: string }

  if (!primaryGoal || !VALID_GOALS.includes(primaryGoal as PrimaryGoal)) {
    return NextResponse.json({ error: 'Invalid goal.' }, { status: 400 })
  }

  // Fetch current profile to get existing goal
  const existing = await db.userProfile.findUnique({
    where: { userId: session.userId },
    select: { primaryGoal: true, goalSetAt: true, previousGoals: true },
  })

  const now = new Date()
  let previousGoals: Prisma.InputJsonValue | undefined

  // If there's an existing goal and it's changing, push old goal to history
  if (existing?.primaryGoal && existing.primaryGoal !== primaryGoal) {
    const current = (Array.isArray(existing.previousGoals) ? existing.previousGoals : []) as Prisma.JsonArray
    previousGoals = [
      ...current,
      {
        goal: existing.primaryGoal,
        setAt: existing.goalSetAt?.toISOString() ?? now.toISOString(),
        changedAt: now.toISOString(),
      },
    ]
  } else if (existing?.previousGoals) {
    previousGoals = existing.previousGoals as Prisma.InputJsonValue
  }

  // Clear stale goalTarget when archetype changes — prevents absurd targets
  // from the old goal persisting on the forecast page
  const isGoalChanging = existing?.primaryGoal && existing.primaryGoal !== primaryGoal

  const profile = await db.userProfile.upsert({
    where: { userId: session.userId },
    create: {
      userId: session.userId,
      primaryGoal,
      goalSetAt: now,
      previousGoals,
    },
    update: {
      primaryGoal,
      goalSetAt: now,
      previousGoals,
      ...(isGoalChanging ? { goalTarget: Prisma.JsonNull } : {}),
    },
    select: {
      primaryGoal: true,
      goalSetAt: true,
    },
  })

  return NextResponse.json(profile)
}
