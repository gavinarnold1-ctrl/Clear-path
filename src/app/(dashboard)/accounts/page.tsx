import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'
import { deleteAccount } from '@/app/actions/accounts'

export const metadata: Metadata = { title: 'Accounts' }

const TYPE_LABELS: Record<string, string> = {
  CHECKING: 'Checking',
  SAVINGS: 'Savings',
  CREDIT_CARD: 'Credit Card',
  INVESTMENT: 'Investment',
  CASH: 'Cash',
}

export default async function AccountsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const accounts = await db.account.findMany({
    where: { userId: session.userId },
    orderBy: { name: 'asc' },
  })

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
        <Link href="/accounts/new" className="btn-primary">
          + Add account
        </Link>
      </div>

      {accounts.length === 0 ? (
        <div className="card py-16 text-center">
          <p className="mb-2 text-sm font-medium text-gray-500">No accounts yet</p>
          <p className="mb-4 text-xs text-gray-400">
            Add a checking, savings, or credit account to start tracking.
          </p>
          <Link href="/accounts/new" className="btn-primary inline-block">
            + Add account
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50 px-6 py-4">
            <p className="text-sm text-brand-700">Net worth</p>
            <p className={`text-3xl font-bold ${totalBalance >= 0 ? 'text-brand-700' : 'text-expense'}`}>
              {formatCurrency(totalBalance)}
            </p>
          </div>

          <div className="space-y-3">
            {accounts.map((account) => (
              <div key={account.id} className="card flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{account.name}</p>
                  <p className="text-xs text-gray-400">
                    {TYPE_LABELS[account.type] ?? account.type} · {account.currency}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <p
                    className={`text-xl font-bold ${
                      account.balance >= 0 ? 'text-gray-900' : 'text-expense'
                    }`}
                  >
                    {formatCurrency(account.balance, account.currency)}
                  </p>
                  <form
                    action={async () => {
                      'use server'
                      await deleteAccount(account.id)
                    }}
                  >
                    <button
                      type="submit"
                      className="text-xs text-gray-400 hover:text-red-500"
                      aria-label={`Delete ${account.name}`}
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
