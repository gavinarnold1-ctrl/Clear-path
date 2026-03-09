import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import ImportWizard from './ImportWizard'

export const metadata: Metadata = { title: 'Import Transactions' }

export default async function ImportPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const accounts = await db.account.findMany({
    where: { userId: session.userId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, type: true },
  })

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-bold text-fjord">Import Transactions</h1>
      <ImportWizard accounts={accounts} />
    </div>
  )
}
