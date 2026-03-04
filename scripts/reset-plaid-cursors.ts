/**
 * One-time migration: Reset Plaid sync cursors for production cutover.
 *
 * Sandbox cursor values are invalid in production. Clearing them forces
 * a full re-sync on the next cron run or manual sync, pulling production
 * transaction history from scratch.
 *
 * Run: npx tsx scripts/reset-plaid-cursors.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function resetCursors() {
  const result = await db.account.updateMany({
    where: {
      plaidItemId: { not: null },
      plaidCursor: { not: null },
    },
    data: {
      plaidCursor: '',
    },
  })

  console.log(`Reset ${result.count} Plaid sync cursors for production cutover`)
}

resetCursors()
  .catch(console.error)
  .finally(() => db.$disconnect())
