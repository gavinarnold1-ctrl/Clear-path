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

      const plaidName = (plaidAccount.official_name || plaidAccount.name).toLowerCase().trim()

      // Try to find an existing manual account to upgrade (merge) instead of creating a duplicate.
      // Match by: same account type AND fuzzy name match (exact, substring, or last-4-digits).
      const manualAccounts = await db.account.findMany({
        where: {
          userId: session.userId,
          type: accountType,
          plaidAccountId: null, // Only match manual (non-Plaid) accounts
        },
      })

      let mergeTarget: typeof manualAccounts[0] | null = null
      for (const manual of manualAccounts) {
        const manualName = manual.name.toLowerCase().trim()
        // Exact match
        if (manualName === plaidName) { mergeTarget = manual; break }
        // Substring containment (e.g. "Adv Plus Banking" vs "Adv Plus Banking (...6809)")
        if (manualName.includes(plaidName) || plaidName.includes(manualName)) { mergeTarget = manual; break }
        // Last 4 digits match (e.g. manual "Checking (...6809)" matches Plaid account mask "6809")
        const mask = plaidAccount.mask
        if (mask) {
          const manualMaskMatch = manualName.match(/\(?\.{0,3}(\d{4})\)?/)
          if (manualMaskMatch && manualMaskMatch[1] === mask) { mergeTarget = manual; break }
        }
      }

      let account
      if (mergeTarget) {
        // Upgrade the existing manual account to a Plaid-connected account
        account = await db.account.update({
          where: { id: mergeTarget.id },
          data: {
            name: plaidAccount.official_name || plaidAccount.name,
            balance,
            institution: institutionName,
            isManual: false,
            plaidAccountId: plaidAccount.account_id,
            plaidItemId: itemId,
            plaidAccessToken: encrypt(accessToken),
            plaidLastSynced: new Date(),
          },
        })
      } else {
        account = await db.account.create({
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
      }
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
