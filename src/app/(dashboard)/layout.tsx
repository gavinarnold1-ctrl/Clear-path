import Link from 'next/link'
import type { ReactNode } from 'react'
import { getSession } from '@/lib/session'
import { logout } from '@/app/actions/auth'
import { db } from '@/lib/db'
import { DEMO_USER_ID } from '@/lib/demo'
import SidebarNav from '@/components/layout/SidebarNav'
import type { NavGroup } from '@/components/layout/SidebarNav'
import { PostHogIdentify } from '@/components/analytics/PostHogIdentify'

function buildNavGroups(hasIdentifiedCards: boolean): NavGroup[] {
  return [
    {
      label: null,
      items: [{ href: '/dashboard', label: 'Dashboard' }],
    },
    {
      label: 'Plan',
      items: [
        { href: '/budgets', label: 'Budgets' },
        { href: '/spending', label: 'Spending' },
        { href: '/transactions', label: 'Transactions' },
      ],
    },
    {
      label: 'Progress',
      items: [
        { href: '/monthly-review', label: 'Monthly Review' },
        { href: '/forecast', label: 'Forecast' },
      ],
    },
    {
      label: 'Manage',
      items: [
        { href: '/accounts', label: 'Accounts' },
        ...(hasIdentifiedCards ? [{ href: '/accounts/benefits', label: 'Card Benefits' }] : []),
        { href: '/debts', label: 'Debts' },
        { href: '/properties', label: 'Properties' },
      ],
    },
    {
      label: 'Setup',
      items: [
        { href: '/settings', label: 'Settings' },
        { href: '/categories', label: 'Categories' },
      ],
    },
  ]
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession()

  // Auto-create profile for new users instead of redirecting to onboarding wizard.
  // The dashboard shows the GetStarted flow inline when accounts.length === 0.
  const isDemo = session?.userId === DEMO_USER_ID
  let profileData: { primaryGoal: string | null; householdType: string | null; incomeRange: string | null } | null = null
  let accountCount = 0
  let hasPlaid = false
  let hasProperties = false
  let hasIdentifiedCards = false
  if (session) {
    const profile = await db.userProfile.findUnique({
      where: { userId: session.userId },
      select: { onboardingCompleted: true, primaryGoal: true, householdType: true, incomeRange: true },
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
    profileData = profile ? { primaryGoal: profile.primaryGoal, householdType: profile.householdType, incomeRange: profile.incomeRange } : null

    const [acctCount, propCount, cardCount] = await Promise.all([
      db.account.count({ where: { userId: session.userId } }),
      db.property.count({ where: { userId: session.userId } }),
      db.userCard.count({ where: { userId: session.userId } }),
    ])
    accountCount = acctCount
    hasProperties = propCount > 0
    hasIdentifiedCards = cardCount > 0
    if (acctCount > 0) {
      const plaidCount = await db.account.count({
        where: { userId: session.userId, plaidAccessToken: { not: null } },
      })
      hasPlaid = plaidCount > 0
    }
  }

  const navGroups = buildNavGroups(hasIdentifiedCards)

  return (
    <div className="flex min-h-screen">
      <SidebarNav
        navGroups={navGroups}
        userName={session?.name ?? null}
        userEmail={session?.email ?? ''}
        logoutAction={logout}
      />

      {session && (
        <PostHogIdentify
          userId={session.userId}
          email={session.email}
          name={session.name ?? undefined}
          goal={profileData?.primaryGoal ?? null}
          householdType={profileData?.householdType ?? null}
          incomeRange={profileData?.incomeRange ?? null}
          accountCount={accountCount}
          hasPlaid={hasPlaid}
          hasProperties={hasProperties}
          isDemo={isDemo}
        />
      )}

      {/* Main content — Snow background */}
      <main id="main-content" className="flex-1 overflow-y-auto bg-snow p-4 pt-16 md:p-8 md:pt-8">
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
