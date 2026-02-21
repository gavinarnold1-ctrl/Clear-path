import Link from 'next/link'
import type { ReactNode } from 'react'

const navItems = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/budgets', label: 'Budgets' },
  { href: '/accounts', label: 'Accounts' },
]

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-gray-200 bg-white px-4 py-6">
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

        <div className="mt-auto pt-6">
          <button className="btn-secondary w-full text-left text-sm">Sign out</button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8">{children}</main>
    </div>
  )
}
