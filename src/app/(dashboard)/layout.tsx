import Link from 'next/link'
import type { ReactNode } from 'react'
import { getSession } from '@/lib/session'
import { logout } from '@/app/actions/auth'

const navItems = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/budgets', label: 'Budgets' },
  { href: '/accounts', label: 'Accounts' },
]

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession()

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-gray-200 bg-white px-4 py-6">
        <Link href="/" className="mb-8 block text-xl font-bold text-brand-700">
          Clear-path
        </Link>

        <nav className="space-y-1">
          {navItems.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-700"
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto space-y-3 pt-6">
          {session && (
            <p className="truncate px-1 text-xs text-gray-400" title={session.email}>
              {session.name ?? session.email}
            </p>
          )}
          <form action={logout}>
            <button type="submit" className="btn-secondary w-full text-sm">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8">{children}</main>
    </div>
  )
}
