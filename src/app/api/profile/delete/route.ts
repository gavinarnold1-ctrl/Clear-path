import { NextRequest, NextResponse } from 'next/server'
import { getSession, clearSession } from '@/lib/session'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/password'
import { plaidClient } from '@/lib/plaid'
import { decrypt } from '@/lib/encryption'
import { DEMO_USER_ID } from '@/lib/demo'

// POST delete account permanently
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (session.userId === DEMO_USER_ID) {
    return NextResponse.json(
      { error: 'Demo accounts cannot be deleted. Sign up for your own account to get started!' },
      { status: 403 }
    )
  }

  const body = await req.json()
  const { password } = body as { password?: string }

  if (!password) {
    return NextResponse.json({ error: 'Password is required to confirm deletion.' }, { status: 400 })
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { password: true },
  })

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const isValid = await verifyPassword(password, user.password)
  if (!isValid) {
    return NextResponse.json({ error: 'Password is incorrect.' }, { status: 403 })
  }

  // Revoke Plaid items before deleting user data
  const plaidAccounts = await db.account.findMany({
    where: { userId: session.userId, plaidAccessToken: { not: null } },
    select: { plaidAccessToken: true, plaidItemId: true },
  })
  const revokedItems = new Set<string>()
  for (const acct of plaidAccounts) {
    if (!acct.plaidAccessToken || !acct.plaidItemId) continue
    if (revokedItems.has(acct.plaidItemId)) continue
    try {
      await plaidClient.itemRemove({ access_token: decrypt(acct.plaidAccessToken) })
      revokedItems.add(acct.plaidItemId)
    } catch (err) {
      console.error(`Failed to revoke Plaid item ${acct.plaidItemId} (non-fatal):`, err)
    }
  }

  // Cascade delete removes all user data (transactions, budgets, accounts, etc.)
  await db.user.delete({ where: { id: session.userId } })

  await clearSession()

  return NextResponse.json({ success: true })
}
