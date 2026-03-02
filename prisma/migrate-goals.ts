/**
 * Goal Migration Script
 *
 * Maps old primaryGoal values to new goal system values for existing users.
 * Safe to run multiple times (idempotent).
 *
 * Usage: npx tsx prisma/migrate-goals.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const GOAL_MAP: Record<string, string> = {
  debt_payoff: 'pay_off_debt',
  emergency_savings: 'save_more',
  major_purchase: 'save_more',
  invest: 'build_wealth',
  organize: 'gain_visibility',
}

async function migrateGoals() {
  const profiles = await db.userProfile.findMany({
    where: {
      primaryGoal: { not: null },
    },
    include: {
      user: { select: { createdAt: true } },
    },
  })

  let updated = 0
  let skipped = 0

  for (const profile of profiles) {
    const oldGoal = profile.primaryGoal
    if (!oldGoal) continue

    const newGoal = GOAL_MAP[oldGoal]
    if (!newGoal) {
      // Already using new goal values
      skipped++
      continue
    }

    await db.userProfile.update({
      where: { id: profile.id },
      data: {
        primaryGoal: newGoal,
        goalSetAt: profile.user.createdAt,
      },
    })
    updated++
    console.log(`  Migrated ${profile.userId}: ${oldGoal} → ${newGoal}`)
  }

  console.log(`\nDone: ${updated} migrated, ${skipped} already current, ${profiles.length} total`)
}

migrateGoals()
  .catch(console.error)
  .finally(() => db.$disconnect())
