import { db } from '@/lib/db'
import { computeExpectedBalance } from '@/lib/balance-engine'

export interface ReconciliationResult {
  accountId: string
  accountName: string
  accountType: string
  isManual: boolean
  plaidBalance: number | null
  computedBalance: number
  discrepancy: number
  discrepancyPercent: number
  possibleCauses: string[]
  lastPlaidSync: Date | null
  transactionsSinceSync: number
  transactionCount: number
  status: 'matched' | 'discrepancy' | 'not_reconciled'
}

/**
 * Reconcile a single account: compare stored balance vs computed balance from transactions.
 * For Plaid accounts, this compares the Plaid-reported balance against expected transaction sums.
 * For manual accounts, this validates the baseline + transaction math.
 */
export async function reconcileAccount(
  accountId: string,
  userId: string
): Promise<ReconciliationResult> {
  const account = await db.account.findFirst({
    where: { id: accountId, userId },
    select: {
      id: true,
      name: true,
      type: true,
      balance: true,
      startingBalance: true,
      balanceAsOfDate: true,
      isManual: true,
      plaidLastSynced: true,
    },
  })

  if (!account) {
    throw new Error('Account not found')
  }

  const computed = await computeExpectedBalance(accountId, userId)
  const storedBalance = account.balance
  const discrepancy = Math.round((storedBalance - computed.computedBalance) * 100) / 100

  // Count transactions since last Plaid sync
  let transactionsSinceSync = 0
  if (!account.isManual && account.plaidLastSynced) {
    const countResult = await db.transaction.count({
      where: {
        accountId,
        userId,
        importSource: { not: 'plaid' },
        date: { gt: account.plaidLastSynced },
      },
    })
    transactionsSinceSync = countResult
  }

  const possibleCauses: string[] = []
  if (Math.abs(discrepancy) > 0.01) {
    if (transactionsSinceSync > 0) {
      possibleCauses.push('Manual transactions not reflected in Plaid balance')
    }

    if (!account.isManual && account.plaidLastSynced) {
      const daysSinceSync = (Date.now() - account.plaidLastSynced.getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceSync > 2) {
        possibleCauses.push('Stale Plaid data — sync may not be running')
      }
    }

    if (Math.abs(discrepancy) > 100) {
      possibleCauses.push('Possible missing or uncategorized transactions')
    }

    if (account.isManual && !account.balanceAsOfDate) {
      possibleCauses.push('No balance-as-of date set — starting balance may be inaccurate')
    }

    if (account.isManual && account.startingBalance === 0 && computed.transactionCount > 0) {
      possibleCauses.push('Starting balance is $0 — set a starting balance for accuracy')
    }
  }

  const status: ReconciliationResult['status'] =
    Math.abs(discrepancy) <= 0.01 ? 'matched' : 'discrepancy'

  // Update reconciliation fields on the account
  await db.account.update({
    where: { id: accountId },
    data: {
      lastReconciled: new Date(),
      reconciliationDiscrepancy: discrepancy,
    },
  })

  return {
    accountId: account.id,
    accountName: account.name,
    accountType: account.type,
    isManual: account.isManual,
    plaidBalance: account.isManual ? null : storedBalance,
    computedBalance: computed.computedBalance,
    discrepancy,
    discrepancyPercent: storedBalance !== 0
      ? Math.round((discrepancy / Math.abs(storedBalance)) * 10000) / 100
      : 0,
    possibleCauses,
    lastPlaidSync: account.plaidLastSynced,
    transactionsSinceSync,
    transactionCount: computed.transactionCount,
    status,
  }
}

/**
 * Reconcile all accounts for a user.
 */
export async function reconcileAllAccounts(
  userId: string
): Promise<ReconciliationResult[]> {
  const accounts = await db.account.findMany({
    where: { userId },
    select: { id: true },
  })

  const results: ReconciliationResult[] = []
  for (const account of accounts) {
    try {
      const result = await reconcileAccount(account.id, userId)
      results.push(result)
    } catch {
      // Skip accounts that error during reconciliation
    }
  }

  return results
}
