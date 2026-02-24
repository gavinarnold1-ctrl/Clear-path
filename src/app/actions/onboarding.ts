'use server'

import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import type {
  OnboardingAnswers,
  OnboardingPendingSetup,
  AccountType,
} from '@/types'

// ─── Save progress on each step (for skip/resume) ─────────────────────────────

export async function saveOnboardingStep(step: number, data: Partial<OnboardingAnswers>) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  const profile = await db.userProfile.findUnique({ where: { userId: session.userId } })
  if (!profile) return { error: 'Profile not found' }

  // Build the partial update — only update fields relevant to the current step
  const update: Record<string, unknown> = {
    onboardingStep: Math.max(profile.onboardingStep, step),
  }

  // Persist simple scalar answers directly
  if (data.primaryGoal !== undefined) update.primaryGoal = data.primaryGoal
  if (data.householdType !== undefined) update.householdType = data.householdType
  if (data.hasRentalProperty !== undefined) update.hasRentalProperty = data.hasRentalProperty
  if (data.debtLevel !== undefined) update.debtLevel = data.debtLevel
  if (data.categoryMode !== undefined) update.categoryMode = data.categoryMode

  // Complex data (accounts, properties, partner name) goes into pendingSetup JSON
  let existing: OnboardingPendingSetup = { accounts: [], properties: [] }
  if (profile.pendingSetup) {
    try {
      existing = JSON.parse(profile.pendingSetup)
    } catch {
      // Reset to defaults if stored JSON is corrupted
    }
  }

  if (data.partnerName !== undefined) existing.partnerName = data.partnerName || undefined
  if (data.accounts !== undefined) existing.accounts = data.accounts
  if (data.properties !== undefined) existing.properties = data.properties

  update.pendingSetup = JSON.stringify(existing)

  await db.userProfile.update({
    where: { userId: session.userId },
    data: update,
  })

  return { success: true }
}

// ─── Complete onboarding (materialize all entities in a transaction) ────────

const RECOMMENDED_CATEGORIES: { name: string; group: string; type: string; isTaxRelevant?: boolean }[] = [
  { name: 'Groceries', group: 'Essentials', type: 'expense' },
  { name: 'Gas', group: 'Essentials', type: 'expense' },
  { name: 'Electric', group: 'Essentials', type: 'expense' },
  { name: 'Cell Phone', group: 'Essentials', type: 'expense' },
  { name: 'Internet', group: 'Essentials', type: 'expense' },
  { name: 'Mortgage', group: 'Living', type: 'expense', isTaxRelevant: true },
  { name: 'Home Improvement', group: 'Living', type: 'expense' },
  { name: 'Car Insurance', group: 'Living', type: 'expense' },
  { name: 'Restaurants', group: 'Lifestyle', type: 'expense' },
  { name: 'Drinks', group: 'Lifestyle', type: 'expense' },
  { name: 'Entertainment', group: 'Lifestyle', type: 'expense' },
  { name: 'Travel', group: 'Lifestyle', type: 'expense' },
  { name: 'Sports & Fitness', group: 'Lifestyle', type: 'expense' },
  { name: 'Personal Care', group: 'Lifestyle', type: 'expense' },
  { name: 'Subscriptions', group: 'Recurring', type: 'expense' },
  { name: 'Medical', group: 'Health', type: 'expense' },
  { name: 'Pets', group: 'Other', type: 'expense' },
  { name: 'Undecided', group: 'Other', type: 'expense' },
]

const RENTAL_CATEGORIES: { name: string; group: string; scheduleE: string }[] = [
  { name: 'Rental Property', group: 'Property', scheduleE: 'Other' },
  { name: 'Rental Repairs', group: 'Property', scheduleE: 'Repairs' },
  { name: 'Rental Insurance', group: 'Property', scheduleE: 'Insurance' },
  { name: 'Rental Utilities', group: 'Property', scheduleE: 'Utilities' },
]

export async function completeOnboarding(answers: OnboardingAnswers) {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  try {
    await db.$transaction(async (tx) => {
      // 1. Update profile with all quiz answers
      await tx.userProfile.update({
        where: { userId: session.userId },
        data: {
          primaryGoal: answers.primaryGoal,
          householdType: answers.householdType,
          hasRentalProperty: answers.hasRentalProperty,
          debtLevel: answers.debtLevel,
          categoryMode: answers.categoryMode,
          onboardingCompleted: true,
          onboardingCompletedAt: new Date(),
          onboardingStep: 6,
          pendingSetup: null, // clear pending data
        },
      })

      // 2. Create household members (Q2)
      if (answers.partnerName?.trim()) {
        await tx.householdMember.create({
          data: {
            userId: session.userId,
            name: answers.partnerName.trim(),
            role: 'partner',
          },
        })
      }

      // 3. Create accounts (Q3)
      const validAccountTypes: AccountType[] = [
        'CHECKING', 'SAVINGS', 'CREDIT_CARD', 'INVESTMENT', 'CASH',
        'MORTGAGE', 'AUTO_LOAN', 'STUDENT_LOAN',
      ]
      for (const account of answers.accounts) {
        if (!account.name.trim()) continue
        if (!validAccountTypes.includes(account.type as AccountType)) continue
        await tx.account.create({
          data: {
            userId: session.userId,
            name: account.name.trim(),
            type: account.type as AccountType,
            isManual: true,
          },
        })
      }

      // 4. Create properties + rental categories (Q4)
      if (answers.hasRentalProperty) {
        for (const property of answers.properties) {
          if (!property.name.trim()) continue
          await tx.property.create({
            data: {
              userId: session.userId,
              name: property.name.trim(),
              type: 'RENTAL',
            },
          })
        }

        // Create rental-specific categories
        for (const cat of RENTAL_CATEGORIES) {
          const exists = await tx.category.findFirst({
            where: {
              userId: session.userId,
              name: cat.name,
              group: cat.group,
            },
          })
          if (!exists) {
            await tx.category.create({
              data: {
                userId: session.userId,
                name: cat.name,
                type: 'expense',
                group: cat.group,
                isTaxRelevant: true,
                scheduleECategory: cat.scheduleE,
                isDefault: false,
              },
            })
          }
        }
      }

      // 5. Create categories based on Q6 selection
      if (answers.categoryMode === 'recommended') {
        for (const cat of RECOMMENDED_CATEGORIES) {
          const exists = await tx.category.findFirst({
            where: {
              userId: session.userId,
              name: cat.name,
              group: cat.group,
            },
          })
          if (!exists) {
            await tx.category.create({
              data: {
                userId: session.userId,
                name: cat.name,
                type: cat.type,
                group: cat.group,
                isTaxRelevant: cat.isTaxRelevant ?? false,
                isDefault: false,
              },
            })
          }
        }
      } else if (answers.categoryMode === 'custom') {
        const exists = await tx.category.findFirst({
          where: {
            userId: session.userId,
            name: 'Uncategorized',
          },
        })
        if (!exists) {
          await tx.category.create({
            data: {
              userId: session.userId,
              name: 'Uncategorized',
              type: 'expense',
              group: 'Other',
              isDefault: false,
            },
          })
        }
      }
      // 'import_match' → no categories created now; CSV import auto-creates them
    })

    return { success: true, categoryMode: answers.categoryMode }
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
    : { accounts: [], properties: [] }

  return {
    step: profile.onboardingStep,
    completed: profile.onboardingCompleted,
    answers: {
      primaryGoal: profile.primaryGoal,
      householdType: profile.householdType,
      partnerName: pending.partnerName ?? null,
      accounts: pending.accounts ?? [],
      hasRentalProperty: profile.hasRentalProperty,
      rentalCount: (pending.properties ?? []).length,
      properties: pending.properties ?? [],
      debtLevel: profile.debtLevel,
      categoryMode: profile.categoryMode,
    } as OnboardingAnswers,
  }
}
