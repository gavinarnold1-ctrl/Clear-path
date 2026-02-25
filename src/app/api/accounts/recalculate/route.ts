import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'

/**
 * POST /api/accounts/recalculate
 * Recalculates all account balances from their linked transactions.
 * Useful after CSV import or if balances look wrong.
 */
export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.userId

  // Get all user accounts
  const accounts = await db.account.findMany({
    where: { userId },
    select: { id: true, name: true, balance: true },
  })

  if (accounts.length === 0) {
    return NextResponse.json({ message: 'No accounts found.', updated: 0 })
  }

  // Sum transaction amounts grouped by accountId
  const sums = await db.transaction.groupBy({
    by: ['accountId'],
    where: { userId, accountId: { not: null } },
    _sum: { amount: true },
  })

  const sumMap = new Map(sums.map((s) => [s.accountId, s._sum.amount ?? 0]))

  // Update each account balance to match its transaction sum
  let updated = 0
  for (const acct of accounts) {
    const newBalance = sumMap.get(acct.id) ?? 0
    if (acct.balance !== newBalance) {
      await db.account.update({
        where: { id: acct.id },
        data: { balance: newBalance },
      })
      updated++
    }
  }

  return NextResponse.json({
    message: `Recalculated ${updated} account balance${updated !== 1 ? 's' : ''}.`,
    updated,
    total: accounts.length,
  })
}
