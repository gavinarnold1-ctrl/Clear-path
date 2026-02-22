import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import TransactionForm from '@/components/forms/TransactionForm'

export const metadata: Metadata = { title: 'New Transaction' }

export default async function NewTransactionPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const [accounts, categories] = await Promise.all([
    db.account.findMany({ where: { userId: session.userId }, orderBy: { name: 'asc' } }),
    db.category.findMany({
      where: { OR: [{ userId: session.userId }, { userId: null, isDefault: true }], isActive: true },
      orderBy: [{ group: 'asc' }, { name: 'asc' }],
    }),
  ])

  if (accounts.length === 0) {
    return (
      <div className="max-w-lg">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">New transaction</h1>
        <div className="card text-center">
          <p className="mb-3 text-sm text-gray-600">
            You need at least one account before you can add transactions.
          </p>
          <Link href="/accounts/new" className="btn-primary inline-block">
            Add an account first
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">New transaction</h1>
      <div className="card">
        <TransactionForm accounts={accounts} categories={categories} />
      </div>
    </div>
  )
}
