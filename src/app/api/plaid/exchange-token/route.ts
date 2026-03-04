import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { plaidClient, mapPlaidAccountType } from '@/lib/plaid'
import { encrypt } from '@/lib/encryption'
import type { DebtType, AccountType } from '@prisma/client'

/** Map loan/credit AccountType → DebtType. Returns null for non-debt account types. */
function accountTypeToDebtType(type: AccountType): DebtType | null {
  switch (type) {
    case 'MORTGAGE': return 'MORTGAGE'
    case 'STUDENT_LOAN': return 'STUDENT_LOAN'
    case 'AUTO_LOAN': return 'AUTO'
    case 'CREDIT_CARD': return 'CREDIT_CARD'
    default: return null
  }
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { public_token } = await request.json()
    if (!public_token) {
      return NextResponse.json({ error: 'Missing public_token' }, { status: 400 })
    }

    // Exchange public token for access token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token,
    })
    const accessToken = exchangeResponse.data.access_token
    const itemId = exchangeResponse.data.item_id

    // Get accounts from Plaid
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    })

    // Get institution name
    let institutionName: string | null = null
    const plaidItem = accountsResponse.data.item
    if (plaidItem.institution_id) {
      try {
        const instResponse = await plaidClient.institutionsGetById({
          institution_id: plaidItem.institution_id,
          country_codes: ['US'] as never[],
        })
        institutionName = instResponse.data.institution.name
      } catch {
        // Non-critical — institution name is optional
      }
    }

    // Create accounts in database
    const createdAccounts = []
    for (const plaidAccount of accountsResponse.data.accounts) {
      // Check if we already have this Plaid account linked
      const existing = await db.account.findFirst({
        where: {
          userId: session.userId,
          plaidAccountId: plaidAccount.account_id,
        },
      })
      if (existing) {
        createdAccounts.push(existing)
        continue
      }

      const accountType = mapPlaidAccountType(
        plaidAccount.type,
        plaidAccount.subtype ?? null,
      )

      // For depository accounts, prefer available balance; for credit, use current
      const balance = plaidAccount.type === 'depository'
        ? (plaidAccount.balances.available ?? plaidAccount.balances.current ?? 0)
        : (plaidAccount.balances.current ?? 0)

      const account = await db.account.create({
        data: {
          userId: session.userId,
          name: plaidAccount.official_name || plaidAccount.name,
          type: accountType,
          balance,
          startingBalance: balance,
          institution: institutionName,
          isManual: false,
          plaidAccountId: plaidAccount.account_id,
          plaidItemId: itemId,
          plaidAccessToken: encrypt(accessToken),
          plaidLastSynced: new Date(),
        },
      })
      createdAccounts.push(account)

      // Auto-create Debt record for loan/credit-type accounts
      const debtType = accountTypeToDebtType(accountType)
      if (debtType) {
        // Credit cards: only create debt if balance > 0
        if (debtType === 'CREDIT_CARD' && balance <= 0) continue

        await db.debt.create({
          data: {
            userId: session.userId,
            name: plaidAccount.official_name || plaidAccount.name,
            type: debtType,
            currentBalance: Math.abs(balance),
            interestRate: 0,
            minimumPayment: 0,
            accountId: account.id,
          },
        })
      }
    }

    return NextResponse.json({
      success: true,
      itemId,
      accounts: createdAccounts.map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        balance: a.balance,
        institution: a.institution,
      })),
    })
  } catch (error) {
    console.error('Plaid token exchange failed:', error)
    return NextResponse.json({ error: 'Failed to connect bank account' }, { status: 500 })
  }
}
