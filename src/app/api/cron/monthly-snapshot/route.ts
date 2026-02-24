import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createMonthlySnapshot } from '@/lib/snapshots'

// POST: Generate monthly snapshots for all active users
// Triggered by Vercel cron on the 1st of each month (R7.7)
export async function POST(req: NextRequest) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Snapshot the previous month
  const now = new Date()
  const prevMonth = now.getMonth() // getMonth() is 0-indexed, so this is last month's 1-indexed value
  const prevYear = prevMonth === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const snapshotMonth = prevMonth === 0 ? 12 : prevMonth

  // Get all users with at least one transaction
  const usersWithData = await db.transaction.groupBy({
    by: ['userId'],
  })

  let created = 0
  let errors = 0

  for (const { userId } of usersWithData) {
    try {
      await createMonthlySnapshot(userId, prevYear, snapshotMonth)
      created++
    } catch {
      errors++
    }
  }

  return NextResponse.json({ created, errors, month: `${prevYear}-${String(snapshotMonth).padStart(2, '0')}` })
}
