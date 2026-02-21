import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { formatCurrency, formatDate } from '@/lib/utils'
import { deleteTransaction } from '@/app/actions/transactions'

export const metadata: Metadata = { title: 'Transactions' }

const TYPE_COLORS = {
  INCOME: 'text-income',
  EXPENSE: 'text-expense',
  TRANSFER: 'text-transfer',
}

const TYPE_LABELS = { INCOME: 'Income', EXPENSE: 'Expense', TRANSFER: 'Transfer' }

export default async function TransactionsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const transactions = await db.transaction.findMany({
    where: { userId: session.userId },
    include: { account: true, category: true },
    orderBy: { date: 'desc' },
  })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
        <Link href="/transactions/new" className="btn-primary">
          + Add transaction
        </Link>
      </div>

      {transactions.length === 0 ? (
        <div className="card text-center py-12">
          <p className="mb-1 text-sm font-medium text-gray-500">No transactions yet</p>
          <p className="mb-4 text-xs text-gray-400">Add your first income or expense to get started.</p>
          <Link href="/transactions/new" className="btn-primary inline-block">
            + Add transaction
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Description</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Category</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Account</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Amount</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{formatDate(tx.date)}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{tx.description}</td>
                  <td className="px-4 py-3 text-gray-500">{tx.category?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{tx.account.name}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${TYPE_COLORS[tx.type]}`}>
                    {tx.type === 'EXPENSE' ? '−' : '+'}
                    {formatCurrency(tx.amount)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form
                      action={async () => {
                        'use server'
                        await deleteTransaction(tx.id)
                      }}
                    >
                      <button
                        type="submit"
                        className="text-xs text-gray-400 hover:text-red-500"
                        aria-label={`Delete ${tx.description}`}
                      >
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-gray-100 px-4 py-2 text-right text-xs text-gray-400">
            {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  )
}
