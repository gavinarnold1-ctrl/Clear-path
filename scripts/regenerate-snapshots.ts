/**
 * Regenerate MonthlySnapshots for all users with a goal target.
 * Loops 12 months oldest→newest so debtPaidDown deltas compute correctly.
 *
 * Usage: npx tsx scripts/regenerate-snapshots.ts
 */

import { Prisma } from '@prisma/client'
import { db } from '../src/lib/db'
import { createMonthlySnapshot } from '../src/lib/snapshots'

async function main() {
  const users = await db.userProfile.findMany({
    where: { goalTarget: { not: Prisma.JsonNull } },
    select: { userId: true },
  })

  console.log(`Found ${users.length} user(s) with goal targets.`)

  const now = new Date()

  for (const { userId } of users) {
    console.log(`\nProcessing user ${userId}...`)

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = d.getFullYear()
      const month = d.getMonth() + 1
      const label = `${year}-${String(month).padStart(2, '0')}`

      try {
        await createMonthlySnapshot(userId, year, month)
        console.log(`  ✓ ${label}`)
      } catch (err) {
        console.error(`  ✗ ${label}: ${err instanceof Error ? err.message : err}`)
      }
    }
  }

  console.log('\nDone.')
  await db.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
