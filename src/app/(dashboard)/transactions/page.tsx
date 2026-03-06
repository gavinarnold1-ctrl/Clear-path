import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import TransactionList from '@/components/transactions/TransactionList'
import { findRefundPairs } from '@/lib/refund-detection'

export const metadata: Metadata = { title: 'Transactions' }

interface PageProps {
  searchParams: Promise<{ categoryId?: string; month?: string; personId?: string; propertyId?: string; accountId?: string; search?: string; classification?: string; annualExpenseId?: string; annualExpenseName?: string; uncategorized?: string; budgetId?: string; tier?: string; catchAll?: string; budgetName?: string }>
}

export default async function TransactionsPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')

  const params = await searchParams
  const initialCategoryId = params.categoryId ?? ''
  const initialMonth = params.month ?? ''
  const initialPersonId = params.personId ?? ''
  const initialPropertyId = params.propertyId ?? ''
  const initialAccountId = params.accountId ?? ''
  const initialSearch = params.search ?? ''
  const initialClassification = params.classification ?? ''
  const initialAnnualExpenseId = params.annualExpenseId ?? ''
  const initialAnnualExpenseName = params.annualExpenseName ?? ''
  const initialUncategorized = params.uncategorized === 'true'
  const initialBudgetId = params.budgetId ?? ''
  const initialTier = params.tier ?? ''
  const initialCatchAll = params.catchAll === 'true'
  const initialBudgetName = params.budgetName ?? ''

  const [transactions, categories, accounts, householdMembers, properties, propertyGroups] = await Promise.all([
    db.transaction.findMany({
      where: { userId: session.userId },
      include: {
        account: true,
        category: true,
        householdMember: true,
        property: true,
        splits: {
          include: { property: { select: { id: true, name: true, taxSchedule: true } } },
          orderBy: { amount: 'desc' },
        },
      },
      orderBy: { date: 'desc' },
    }),
    db.category.findMany({
      where: {
        OR: [{ userId: session.userId }, { userId: null, isDefault: true }],
        isActive: true,
      },
      orderBy: [{ group: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, group: true, type: true },
    }),
    db.account.findMany({
      where: { userId: session.userId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, type: true },
    }),
    db.householdMember.findMany({
      where: { userId: session.userId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, isDefault: true },
    }),
    db.property.findMany({
      where: { userId: session.userId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, type: true, isDefault: true, groupId: true },
    }),
    db.propertyGroup.findMany({
      where: { userId: session.userId },
      include: {
        properties: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
      },
      orderBy: { name: 'asc' },
    }),
  ])

  // Detect refund pairs for badge display
  const refundPairIds = findRefundPairs(
    transactions.map(tx => ({ id: tx.id, merchant: tx.merchant, amount: tx.amount, date: tx.date.toISOString(), accountId: tx.accountId }))
  )

  // Serialize dates for the client component
  const serialized = transactions.map(tx => ({
    id: tx.id,
    date: tx.date.toISOString(),
    merchant: tx.merchant,
    amount: tx.amount,
    notes: tx.notes,
    categoryId: tx.categoryId,
    accountId: tx.accountId,
    householdMemberId: tx.householdMemberId,
    propertyId: tx.propertyId,
    category: tx.category ? { id: tx.category.id, name: tx.category.name } : null,
    account: tx.account ? { id: tx.account.id, name: tx.account.name } : null,
    householdMember: tx.householdMember ? { id: tx.householdMember.id, name: tx.householdMember.name } : null,
    property: tx.property ? { id: tx.property.id, name: tx.property.name } : null,
    classification: tx.classification,
    annualExpenseId: tx.annualExpenseId,
    splits: tx.splits.map(s => ({
      id: s.id,
      propertyId: s.propertyId,
      amount: s.amount,
      property: s.property ? { id: s.property.id, name: s.property.name, taxSchedule: s.property.taxSchedule } : null,
    })),
  }))

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-fjord">Transactions</h1>
        <div className="flex gap-3">
          <Button variant="secondary" href="/transactions/import">
            Import CSV
          </Button>
          <Button href="/transactions/new">
            + Add transaction
          </Button>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="card">
          <EmptyState
            title="No transactions yet"
            description="Add your first income or expense to get started."
            action={{ label: "+ Add transaction", href: "/transactions/new" }}
          />
        </div>
      ) : (
        <TransactionList
          transactions={serialized}
          categories={categories}
          accounts={accounts}
          householdMembers={householdMembers}
          properties={properties}
          propertyGroups={propertyGroups.map(g => ({
            id: g.id,
            name: g.name,
            propertyIds: g.properties.map(p => p.id),
          }))}
          initialCategoryId={initialCategoryId}
          initialMonth={initialMonth}
          initialPersonId={initialPersonId}
          initialPropertyId={initialPropertyId}
          initialAccountId={initialAccountId}
          initialSearch={initialSearch}
          initialClassification={initialClassification}
          initialAnnualExpenseId={initialAnnualExpenseId}
          initialAnnualExpenseName={initialAnnualExpenseName}
          initialUncategorized={initialUncategorized}
          initialBudgetId={initialBudgetId}
          initialTier={initialTier}
          initialCatchAll={initialCatchAll}
          initialBudgetName={initialBudgetName}
          refundedTxIds={[...refundPairIds]}
        />
      )}
    </div>
  )
}
