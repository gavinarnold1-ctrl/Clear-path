import { db } from '@/lib/db'

export interface ComputedBalance {
  computedBalance: number
  transactionCount: number
  oldestTransaction: Date | null
  newestTransaction: Date | null
}

/**
 * Compute an expected balance for any account based on its transactions.
 *
 * For manual/CSV accounts:
 *   - If startingBalance + balanceAsOfDate are set: startingBalance + sum(transactions after balanceAsOfDate)
 *   - If only startingBalance: startingBalance + sum(all transactions)
 *   - If neither: sum(all transactions) — unreliable, flagged in UI
 *
 * For Plaid accounts:
 *   - Last known Plaid balance + sum(manual transactions since last Plaid sync)
 *   - This catches user-added transactions that Plaid doesn't know about
 */
export async function computeExpectedBalance(
  accountId: string,
  userId: string
): Promise<ComputedBalance> {
  const account = await db.account.findFirst({
    where: { id: accountId, userId },
    select: {
      balance: true,
      startingBalance: true,
      balanceAsOfDate: true,
      isManual: true,
      plaidLastSynced: true,
    },
  })

  if (!account) {
    return { computedBalance: 0, transactionCount: 0, oldestTransaction: null, newestTransaction: null }
  }

  if (!account.isManual && account.plaidLastSynced) {
    // Plaid account: current Plaid balance + manual transactions since last sync
    const manualTxSinceSync = await db.transaction.aggregate({
      where: {
        accountId,
        userId,
        importSource: { not: 'plaid' },
        date: { gt: account.plaidLastSynced },
      },
      _sum: { amount: true },
      _count: { id: true },
    })

    const txStats = await db.transaction.aggregate({
      where: { accountId, userId },
      _min: { date: true },
      _max: { date: true },
      _count: { id: true },
    })

    return {
      computedBalance: Math.round((account.balance + (manualTxSinceSync._sum.amount ?? 0)) * 100) / 100,
      transactionCount: txStats._count.id,
      oldestTransaction: txStats._min.date,
      newestTransaction: txStats._max.date,
    }
  }

  // Manual/CSV account: baseline model
  const dateFilter = account.balanceAsOfDate ? { gt: account.balanceAsOfDate } : undefined
  const [agg, stats] = await Promise.all([
    db.transaction.aggregate({
      where: {
        accountId,
        userId,
        ...(dateFilter && { date: dateFilter }),
      },
      _sum: { amount: true },
    }),
    db.transaction.aggregate({
      where: { accountId, userId },
      _min: { date: true },
      _max: { date: true },
      _count: { id: true },
    }),
  ])

  const computedBalance = Math.round(
    (account.startingBalance + (agg._sum.amount ?? 0)) * 100
  ) / 100

  return {
    computedBalance,
    transactionCount: stats._count.id,
    oldestTransaction: stats._min.date,
    newestTransaction: stats._max.date,
  }
}

/**
 * Recompute and update account balance from transactions.
 * Called after transaction create/update/delete for manual accounts.
 */
export async function recomputeAccountBalance(
  accountId: string,
  userId: string
): Promise<number> {
  const account = await db.account.findFirst({
    where: { id: accountId, userId },
    select: { startingBalance: true, balanceAsOfDate: true, isManual: true },
  })

  if (!account || !account.isManual) return 0

  // Per convention: until the user sets a baseline (startingBalance + balanceAsOfDate),
  // balance stays at $0. Computing from transactions without a reference point is misleading.
  if (!account.balanceAsOfDate && account.startingBalance === 0) {
    await db.account.update({
      where: { id: accountId },
      data: { balance: 0, balanceSource: 'manual' },
    })
    return 0
  }

  const dateFilter = account.balanceAsOfDate ? { gt: account.balanceAsOfDate } : undefined
  const agg = await db.transaction.aggregate({
    where: {
      accountId,
      userId,
      ...(dateFilter && { date: dateFilter }),
    },
    _sum: { amount: true },
  })

  const newBalance = Math.round(
    (account.startingBalance + (agg._sum.amount ?? 0)) * 100
  ) / 100

  await db.account.update({
    where: { id: accountId },
    data: { balance: newBalance, balanceSource: 'computed' },
  })

  return newBalance
}
