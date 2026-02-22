import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import TransactionForm from '@/components/forms/TransactionForm'

export const metadata: Metadata = { title: 'New Transaction' }

export default async function NewTransactionPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const [accounts, categories] = await Promise.all([
    db.account.findMany({ where: { userId: session.userId }, orderBy: { name: 'asc' } }),
    db.category.findMany({ where: { userId: session.userId }, orderBy: { name: 'asc' } }),
  ])

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">New transaction</h1>
      <div className="card">
        <TransactionForm accounts={accounts} categories={categories} />
      </div>
    </div>
  )
}
