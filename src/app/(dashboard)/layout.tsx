import Link from 'next/link'
import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { logout } from '@/app/actions/auth'
import { db } from '@/lib/db'
import { DEMO_USER_ID } from '@/lib/demo'
import OnboardingBanner from '@/components/onboarding/OnboardingBanner'

const navItems = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/insights', label: 'Insights' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/spending', label: 'Spending' },
  { href: '/budgets', label: 'Budgets' },
  { href: '/budgets/annual', label: 'Annual Plan' },
  { href: '/debts', label: 'Debts' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/categories', label: 'Categories' },
]

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession()

  // Redirect to onboarding if profile doesn't exist (new user, never seen quiz)
  let showOnboardingBanner = false
  let onboardingStep = 0
  const isDemo = session?.userId === DEMO_USER_ID
  if (session) {
    const profile = await db.userProfile.findUnique({
      where: { userId: session.userId },
      select: { onboardingCompleted: true, onboardingStep: true },
    })
    if (!profile) {
      redirect('/onboarding')
    }
    if (!profile.onboardingCompleted) {
      showOnboardingBanner = true
      onboardingStep = profile.onboardingStep
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar — Fjord background per brand spec */}
      <aside className="flex w-52 shrink-0 flex-col bg-fjord px-4 py-6">
        <Link href="/" className="mb-8 flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-frost/15 font-display text-sm text-snow">
            O
          </span>
          <span className="font-display text-base tracking-tight text-snow">oversikt</span>
        </Link>

        <nav className="space-y-0.5">
          {navItems.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="block rounded-md px-3 py-2 text-[13px] font-medium text-snow/50 hover:bg-frost/10 hover:text-snow"
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto space-y-3 pt-6">
          {session && (
            <p className="truncate px-1 text-xs text-snow/40" title={session.email}>
              {session.name ?? session.email}
            </p>
          )}
          <form action={logout}>
            <button
              type="submit"
              className="w-full rounded-button border border-white/20 bg-transparent px-3 py-2 text-xs font-medium text-snow/60 hover:bg-frost/10 hover:text-snow"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content — Snow background */}
      <main className="flex-1 overflow-y-auto bg-snow p-8">
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
        {showOnboardingBanner && <OnboardingBanner step={onboardingStep} />}
        {children}
      </main>
    </div>
  )
}
