import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'

/**
 * POST /api/accounts/recalculate
 * Recalculates all account balances using the baseline formula:
 *   balance = startingBalance + sum(transactions WHERE date >= balanceAsOfDate)
 *
 * R1.5b: CSV-imported accounts don't auto-compute balance. Users set a
 * startingBalance as of a date, and only transactions after that date
 * adjust the running balance. If no balanceAsOfDate is set, all
 * transactions are summed (backwards-compatible).
 */
export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.userId

  const accounts = await db.account.findMany({
    where: { userId },
    select: { id: true, name: true, balance: true, startingBalance: true, balanceAsOfDate: true },
  })

  if (accounts.length === 0) {
    return NextResponse.json({ message: 'No accounts found.', updated: 0 })
  }

  let updated = 0
  for (const acct of accounts) {
    // Sum transactions that fall on or after the baseline date.
    // If no baseline date, sum all transactions for this account.
    const dateFilter = acct.balanceAsOfDate
      ? { gte: acct.balanceAsOfDate }
      : undefined

    const agg = await db.transaction.aggregate({
      where: {
        userId,
        accountId: acct.id,
        ...(dateFilter && { date: dateFilter }),
      },
      _sum: { amount: true },
    })

    const txSum = agg._sum.amount ?? 0
    const newBalance = Math.round((acct.startingBalance + txSum) * 100) / 100

    if (Math.abs(acct.balance - newBalance) > 0.001) {
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
