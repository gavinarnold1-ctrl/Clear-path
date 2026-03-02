'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'

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
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Close sidebar on Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false)
  }, [])

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, handleKeyDown])

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed left-3 top-3 z-40 flex h-10 w-10 items-center justify-center rounded-button bg-fjord text-snow md:hidden"
        aria-label="Open navigation menu"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <line x1="3" y1="5" x2="17" y2="5" />
          <line x1="3" y1="10" x2="17" y2="10" />
          <line x1="3" y1="15" x2="17" y2="15" />
        </svg>
      </button>

      {/* Mobile overlay backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-midnight/50 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex w-52 shrink-0 flex-col bg-fjord px-4 py-6
          transition-transform duration-200 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full'}
          md:static md:translate-x-0
        `}
      >
        {/* Mobile close button */}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-button text-snow/60 hover:text-snow md:hidden"
          aria-label="Close navigation menu"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="4" y1="4" x2="14" y2="14" />
            <line x1="14" y1="4" x2="4" y2="14" />
          </svg>
        </button>

        <Link href="/" className="mb-8 flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-frost/15 font-display text-sm text-snow">
            O
          </span>
          <span className="font-display text-base tracking-tight text-snow">oversikt</span>
        </Link>

        <nav className="space-y-4">
          {navGroups.map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-snow/30">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
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
    </>
  )
}
