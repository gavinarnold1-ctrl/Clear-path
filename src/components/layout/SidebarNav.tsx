'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { trackSidebarNavClicked, trackLogout } from '@/lib/analytics'

export interface NavGroup {
  label: string | null
  items: { href: string; label: string }[]
}

interface SidebarNavProps {
  navGroups: NavGroup[]
  userName: string | null
  userEmail: string
  logoutAction: () => Promise<void>
}

export default function SidebarNav({ navGroups, userName, userEmail, logoutAction }: SidebarNavProps) {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 z-50 w-52 shrink-0 flex-col bg-fjord px-4 py-6 md:static">
      <Link href="/" className="mb-8 flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-frost/15 font-display text-sm text-snow">
          O
        </span>
        <span className="font-display text-base tracking-tight text-snow">oversikt</span>
      </Link>

      <nav className="space-y-3">
        {navGroups.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <p className="mb-1 border-b border-snow/10 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-snow/40">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => trackSidebarNavClicked(href)}
                  className={`block rounded-md px-3 py-2 text-[13px] font-medium ${
                    pathname === href
                      ? 'bg-frost/15 text-snow'
                      : 'text-snow/50 hover:bg-frost/10 hover:text-snow'
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-auto space-y-3 pt-6">
        <p className="truncate px-1 text-xs text-snow/40" title={userEmail}>
          {userName ?? userEmail}
        </p>
        <form action={logoutAction}>
          <button
            type="submit"
            onClick={() => trackLogout()}
            className="w-full rounded-button border border-white/20 bg-transparent px-3 py-2 text-xs font-medium text-snow/60 hover:bg-frost/10 hover:text-snow"
          >
            Sign out
          </button>
        </form>
        <div className="flex gap-2 px-1 text-[10px] text-snow/30">
          <Link href="/security" className="hover:text-snow/60">Security</Link>
          <span>&middot;</span>
          <Link href="/privacy" className="hover:text-snow/60">Privacy</Link>
          <span>&middot;</span>
          <Link href="/terms" className="hover:text-snow/60">Terms</Link>
        </div>
      </div>
    </aside>
  )
}
