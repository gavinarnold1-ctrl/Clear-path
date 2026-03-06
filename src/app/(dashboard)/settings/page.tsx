import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import SettingsClient from './SettingsClient'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const [user, householdMembers, properties, accounts, profile] = await Promise.all([
    db.user.findUnique({
      where: { id: session.userId },
      select: { id: true, name: true, email: true, createdAt: true },
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
    db.account.findMany({
      where: { userId: session.userId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, type: true },
    }),
    db.userProfile.findUnique({
      where: { userId: session.userId },
      select: { primaryGoal: true, goalSetAt: true, previousGoals: true },
    }),
  ])

  if (!user) redirect('/login')

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-fjord">Settings</h1>
      <SettingsClient
        user={{ name: user.name ?? '', email: user.email, createdAt: user.createdAt.toISOString() }}
        initialMembers={householdMembers}
        initialProperties={properties}
        initialAccounts={accounts}
        initialGoal={profile?.primaryGoal ?? null}
        goalSetAt={profile?.goalSetAt?.toISOString() ?? null}
        previousGoals={(profile?.previousGoals as Array<{ goal: string; setAt: string; changedAt: string }>) ?? []}
      />
    </div>
  )
}
