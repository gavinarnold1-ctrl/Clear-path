import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import TransactionList from '@/components/transactions/TransactionList'

export const metadata: Metadata = { title: 'Transactions' }

interface PageProps {
  searchParams: Promise<{ categoryId?: string; month?: string; personId?: string; propertyId?: string }>
}

export default async function TransactionsPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')

  const params = await searchParams
  const initialCategoryId = params.categoryId ?? ''
  const initialMonth = params.month ?? ''
  const initialPersonId = params.personId ?? ''
  const initialPropertyId = params.propertyId ?? ''

  const [transactions, categories, accounts, householdMembers, properties] = await Promise.all([
    db.transaction.findMany({
      where: { userId: session.userId },
      include: { account: true, category: true, householdMember: true, property: true },
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
      select: { id: true, name: true, type: true, isDefault: true },
    }),
  ])

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
  }))

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-fjord">Transactions</h1>
        <div className="flex gap-3">
          <Link href="/transactions/import" className="btn-secondary">
            Import CSV
          </Link>
          <Link href="/transactions/new" className="btn-primary">
            + Add transaction
          </Link>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="card text-center py-12">
          <p className="mb-1 text-sm font-medium text-stone">No transactions yet</p>
          <p className="mb-4 text-xs text-stone">Add your first income or expense to get started.</p>
          <Link href="/transactions/new" className="btn-primary inline-block">
            + Add transaction
          </Link>
        </div>
      ) : (
        <TransactionList
          transactions={serialized}
          categories={categories}
          accounts={accounts}
          householdMembers={householdMembers}
          properties={properties}
          initialCategoryId={initialCategoryId}
          initialMonth={initialMonth}
          initialPersonId={initialPersonId}
          initialPropertyId={initialPropertyId}
        />
      )}
    </div>
  )
}
