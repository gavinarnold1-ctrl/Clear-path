import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import AccountManager from '@/components/accounts/AccountManager'
import CardIdentification from '@/components/accounts/CardIdentification'

export const metadata: Metadata = { title: 'Accounts' }

export default async function AccountsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const [accounts, txCounts, householdMembers, propertiesForNW, linkedAccountLinks] = await Promise.all([
    db.account.findMany({
      where: { userId: session.userId },
      include: { owner: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    }),
    db.transaction.groupBy({
      by: ['accountId'],
      where: { userId: session.userId },
      _count: { id: true },
    }),
    db.householdMember.findMany({
      where: { userId: session.userId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    db.property.findMany({
      where: { userId: session.userId, currentValue: { not: null } },
      select: { id: true, name: true, currentValue: true, loanBalance: true },
    }),
    db.accountPropertyLink.findMany({
      where: { account: { userId: session.userId }, property: { currentValue: { not: null } } },
      select: { accountId: true },
    }),
  ])

  const countMap = new Map(
    txCounts
      .filter(r => r.accountId !== null)
      .map(r => [r.accountId as string, r._count.id])
  )

  const serialized = accounts.map(acct => ({
    id: acct.id,
    name: acct.name,
    type: acct.type,
    balance: acct.balance,
    startingBalance: acct.startingBalance,
    balanceAsOfDate: acct.balanceAsOfDate ? acct.balanceAsOfDate.toISOString().split('T')[0] : null,
    currency: acct.currency,
    institution: acct.institution,
    isManual: acct.isManual,
    plaidLastSynced: acct.plaidLastSynced ? acct.plaidLastSynced.toISOString() : null,
    ownerId: acct.ownerId,
    ownerName: acct.owner?.name ?? null,
    txCount: countMap.get(acct.id) ?? 0,
  }))

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-fjord">Accounts</h1>
        <Button href="/accounts/new">
          + Add account
        </Button>
      </div>

      {accounts.length === 0 ? (
        <div className="card">
          <EmptyState
            title="No accounts yet"
            description="Add a checking, savings, or credit account to start tracking."
            action={{ label: "+ Add account", href: "/accounts/new" }}
          />
        </div>
      ) : (
        <>
        <CardIdentification />
        <AccountManager
          accounts={serialized}
          householdMembers={householdMembers}
          propertyEquity={propertiesForNW.reduce((sum, p) => sum + (p.currentValue ?? 0) - (p.loanBalance ?? 0), 0)}
          linkedAccountIds={linkedAccountLinks.map(l => l.accountId)}
        />
        </>
      )}
    </div>
  )
}
