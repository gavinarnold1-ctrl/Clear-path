import Link from 'next/link'
import type { ReactNode } from 'react'
import { getSession } from '@/lib/session'
import { logout } from '@/app/actions/auth'
import { db } from '@/lib/db'
import { DEMO_USER_ID } from '@/lib/demo'
import SidebarNav from '@/components/layout/SidebarNav'
import type { NavGroup } from '@/components/layout/SidebarNav'

const navGroups: NavGroup[] = [
  {
    label: null,
    items: [
      { href: '/dashboard', label: 'Overview' },
      { href: '/budgets', label: 'Budgets' },
      { href: '/spending', label: 'Spending' },
      { href: '/budgets/annual', label: 'Annual Plan' },
      { href: '/debts', label: 'Debts' },
      { href: '/transactions', label: 'Transactions' },
    ],
  },
  {
    label: 'Periodic',
    items: [
      { href: '/monthly-review', label: 'Monthly Review' },
    ],
  },
  {
    label: 'Setup',
    items: [
      { href: '/settings', label: 'Settings' },
      { href: '/accounts', label: 'Accounts' },
      { href: '/categories', label: 'Categories' },
    ],
  },
]

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession()

  // Auto-create profile for new users instead of redirecting to onboarding wizard.
  // The dashboard shows the GetStarted flow inline when accounts.length === 0.
  const isDemo = session?.userId === DEMO_USER_ID
  if (session) {
    const profile = await db.userProfile.findUnique({
      where: { userId: session.userId },
      select: { onboardingCompleted: true },
    })
    if (!profile) {
      await db.userProfile.create({
        data: {
          userId: session.userId,
          onboardingCompleted: true,
          onboardingStep: 0,
        },
      })
    }
  }

  return (
    <div className="flex min-h-screen">
      <SidebarNav
        navGroups={navGroups}
        userName={session?.name ?? null}
        userEmail={session?.email ?? ''}
        logoutAction={logout}
      />

      {/* Main content — Snow background */}
      <main className="flex-1 overflow-y-auto bg-snow p-4 pt-16 md:p-8 md:pt-8">
        {isDemo && (
          <div className="mb-4 flex items-center justify-between rounded-card bg-birch/30 px-4 py-2.5 text-sm text-midnight">
            <span>
              <strong className="font-medium">Demo Mode</strong> — data resets periodically
            </span>
            <Link href="/register" className="font-medium text-fjord hover:text-midnight underline">
              Sign up for free
            </Link>
          </div>
        )}
        {children}
      </main>
    </div>
  )
}
