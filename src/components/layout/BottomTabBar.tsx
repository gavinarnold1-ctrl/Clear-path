'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { trackSidebarNavClicked, trackLogout } from '@/lib/analytics'

interface BottomTabBarProps {
  logoutAction: () => Promise<void>
}

const TABS = [
  { href: '/dashboard', label: 'Home', icon: HomeIcon },
  { href: '/budgets', label: 'Budget', icon: WalletIcon },
  { href: '/transactions', label: 'Txns', icon: ListIcon },
  { href: '/spending', label: 'Spending', icon: ChartIcon },
] as const

const MORE_ITEMS = [
  { href: '/forecast', label: 'Forecast' },
  { href: '/monthly-review', label: 'Monthly Review' },
  { href: '/budgets/annual', label: 'Annual Plan' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/debts', label: 'Debts' },
  { href: '/properties', label: 'Properties' },
  { href: '/categories', label: 'Categories' },
  { href: '/settings', label: 'Settings' },
]

export default function BottomTabBar({ logoutAction }: BottomTabBarProps) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  // Close sheet on route change
  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  // Close on escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setMoreOpen(false)
  }, [])

  useEffect(() => {
    if (moreOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [moreOpen, handleKeyDown])

  const isMoreActive = MORE_ITEMS.some((item) => pathname === item.href)

  return (
    <>
      {/* More sheet backdrop */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-fjord/50 md:hidden"
          onClick={() => setMoreOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* More sheet */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 transform transition-transform duration-200 ease-in-out md:hidden ${
          moreOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="rounded-t-card bg-snow shadow-lg">
          {/* Drag handle */}
          <div className="flex justify-center pb-2 pt-3">
            <div className="h-1 w-10 rounded-full bg-mist" />
          </div>

          <nav className="max-h-[60vh] overflow-y-auto px-4 pb-4">
            {MORE_ITEMS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => trackSidebarNavClicked(href)}
                className={`flex h-12 items-center rounded-button px-3 text-sm font-medium transition-colors ${
                  pathname === href
                    ? 'bg-frost text-pine'
                    : 'text-fjord hover:bg-frost'
                }`}
              >
                {label}
              </Link>
            ))}
            <div className="my-2 border-t border-mist" />
            <form action={logoutAction}>
              <button
                type="submit"
                onClick={() => trackLogout()}
                className="flex h-12 w-full items-center rounded-button px-3 text-sm font-medium text-ember transition-colors hover:bg-frost"
              >
                Log out
              </button>
            </form>
          </nav>
        </div>
      </div>

      {/* Tab bar */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-mist bg-snow md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <nav className="flex h-14 items-stretch">
          {TABS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href === '/budgets' && pathname.startsWith('/budgets/'))
            return (
              <Link
                key={href}
                href={href}
                onClick={() => trackSidebarNavClicked(href)}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] ${
                  isActive ? 'font-semibold text-pine' : 'font-normal text-stone'
                }`}
              >
                <Icon active={isActive} />
                {label}
              </Link>
            )
          })}

          {/* More tab */}
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] ${
              moreOpen || isMoreActive ? 'font-semibold text-pine' : 'font-normal text-stone'
            }`}
          >
            <MoreIcon active={moreOpen || isMoreActive} />
            More
          </button>
        </nav>
      </div>
    </>
  )
}

// ── Inline SVG icons (24×24) ────────────────────────────────────────────────

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12l9-8 9 8" />
      <path d="M5 10v9a1 1 0 001 1h3v-5h6v5h3a1 1 0 001-1v-9" />
    </svg>
  )
}

function WalletIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="15" rx="2" />
      <path d="M16 12h2" />
      <path d="M2 10h20" />
    </svg>
  )
}

function ListIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5h11" />
      <path d="M9 12h11" />
      <path d="M9 19h11" />
      <circle cx="5" cy="5" r="1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="19" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function ChartIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.21 15.89A10 10 0 118 2.83" />
      <path d="M22 12A10 10 0 0012 2v10z" />
    </svg>
  )
}

function MoreIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}
