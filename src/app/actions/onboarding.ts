'use server'

import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import type {
  OnboardingAnswers,
  OnboardingPendingSetup,
} from '@/types'

// ─── Income range midpoints ─────────────────────────────────────────────────

const INCOME_MIDPOINTS: Record<string, number> = {
  under_50k: 3333,
  '50k_100k': 6250,
  '100k_150k': 10417,
  '150k_200k': 14583,
  '200k_300k': 20833,
  over_300k: 30000,
}

// ─── Save progress on each step (for skip/resume) ─────────────────────────────

export async function saveOnboardingStep(step: number, data: Partial<OnboardingAnswers>) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  const profile = await db.userProfile.findUnique({ where: { userId: session.userId } })
  if (!profile) return { error: 'Profile not found' }

  const update: Record<string, unknown> = {
    onboardingStep: Math.max(profile.onboardingStep, step),
  }

  // Persist scalar answers directly
  if (data.primaryGoal !== undefined) {
    update.primaryGoal = data.primaryGoal
    update.goalSetAt = new Date()
  }
  if (data.householdType !== undefined) update.householdType = data.householdType
  if (data.incomeRange !== undefined) update.incomeRange = data.incomeRange

  // Partner name goes into pendingSetup JSON
  let existing: OnboardingPendingSetup = {}
  if (profile.pendingSetup) {
    try {
      existing = JSON.parse(profile.pendingSetup)
    } catch {
      // Reset to defaults if stored JSON is corrupted
    }
  }

  if (data.partnerName !== undefined) existing.partnerName = data.partnerName || undefined

  update.pendingSetup = JSON.stringify(existing)

  await db.userProfile.update({
    where: { userId: session.userId },
    data: update,
  })

  return { success: true }
}

// ─── Complete onboarding (materialize all entities in a transaction) ────────

export async function completeOnboarding(answers: OnboardingAnswers) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  try {
    await db.$transaction(async (tx) => {
      // 1. Update profile with all quiz answers
      const profileUpdate: Record<string, unknown> = {
        primaryGoal: answers.primaryGoal,
        goalSetAt: new Date(),
        householdType: answers.householdType,
        incomeRange: answers.incomeRange,
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
        onboardingStep: 3,
        pendingSetup: null,
      }

      // Pre-fill expectedMonthlyIncome from income range midpoint
      if (answers.incomeRange && INCOME_MIDPOINTS[answers.incomeRange]) {
        profileUpdate.expectedMonthlyIncome = INCOME_MIDPOINTS[answers.incomeRange]
      }

      await tx.userProfile.update({
        where: { userId: session.userId },
        data: profileUpdate,
      })

      // 2. Create household member if partner name provided
      if (answers.partnerName?.trim()) {
        await tx.householdMember.create({
          data: {
            userId: session.userId,
            name: answers.partnerName.trim(),
          },
        })
      }
    })

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to complete onboarding'
    return { error: message }
  }
}

// ─── Skip onboarding ──────────────────────────────────────────────────────────

export async function skipOnboarding() {
  const session = await getSession()
  if (!session) return

  // Ensure profile exists (onboardingCompleted stays false)
  await db.userProfile.upsert({
    where: { userId: session.userId },
    update: {},
    create: { userId: session.userId },
  })

  redirect('/dashboard')
}

// ─── Load saved onboarding progress ───────────────────────────────────────────

export async function getOnboardingState() {
  const session = await getSession()
  if (!session) return null

  const profile = await db.userProfile.findUnique({
    where: { userId: session.userId },
  })

  if (!profile) return null

  const pending: OnboardingPendingSetup = profile.pendingSetup
    ? JSON.parse(profile.pendingSetup)
    : {}

  return {
    step: profile.onboardingStep,
    completed: profile.onboardingCompleted,
    answers: {
      primaryGoal: profile.primaryGoal,
      householdType: profile.householdType,
      partnerName: pending.partnerName ?? null,
      incomeRange: profile.incomeRange ?? null,
    } as OnboardingAnswers,
  }
}
