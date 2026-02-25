import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { plaidClient } from '@/lib/plaid'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Find all Plaid-connected accounts for this user, grouped by itemId
    const plaidAccounts = await db.account.findMany({
      where: { userId: session.userId, plaidItemId: { not: null } },
    })

    if (plaidAccounts.length === 0) {
      return NextResponse.json({ error: 'No Plaid-connected accounts found' }, { status: 404 })
    }

    // Group by itemId
    const itemGroups = new Map<string, typeof plaidAccounts>()
    for (const acct of plaidAccounts) {
      const key = acct.plaidItemId!
      if (!itemGroups.has(key)) itemGroups.set(key, [])
      itemGroups.get(key)!.push(acct)
    }

    const updatedAccounts = []

    for (const [, accounts] of itemGroups) {
      const accessToken = accounts[0].plaidAccessToken!

      const balanceResponse = await plaidClient.accountsBalanceGet({
        access_token: accessToken,
      })

      for (const plaidAccount of balanceResponse.data.accounts) {
        const ourAccount = accounts.find(a => a.plaidAccountId === plaidAccount.account_id)
        if (!ourAccount) continue

        // For depository accounts, prefer available; for credit/loan, use current
        const balance = plaidAccount.type === 'depository'
          ? (plaidAccount.balances.available ?? plaidAccount.balances.current ?? 0)
          : (plaidAccount.balances.current ?? 0)

        await db.account.update({
          where: { id: ourAccount.id },
          data: {
            balance,
            plaidLastSynced: new Date(),
          },
        })

        updatedAccounts.push({
          id: ourAccount.id,
          name: ourAccount.name,
          balance,
        })
      }
    }

    return NextResponse.json({ accounts: updatedAccounts })
  } catch (error) {
    console.error('Plaid balance refresh failed:', error)
    return NextResponse.json({ error: 'Failed to refresh balances' }, { status: 500 })
  }
}
