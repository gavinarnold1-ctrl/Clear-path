import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import AccountForm from '@/components/forms/AccountForm'

export const metadata: Metadata = { title: 'New Account' }

export default async function NewAccountPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-2xl font-bold text-fjord">Add an account</h1>
      <div className="card">
        <AccountForm />
      </div>
    </div>
  )
}
