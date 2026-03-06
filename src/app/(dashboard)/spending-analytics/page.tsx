import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import SpendingAnalyticsClient from './SpendingAnalyticsClient'

export default async function SpendingAnalyticsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  return <SpendingAnalyticsClient />
}
