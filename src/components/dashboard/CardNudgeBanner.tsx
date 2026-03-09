'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const STORAGE_KEY = 'oversikt-dismissed-card-nudge'

export default function CardNudgeBanner({ count }: { count: number }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true)
    }
  }, [])

  if (!visible || count === 0) return null

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, 'true')
    setVisible(false)
  }

  return (
    <div className="mb-6 rounded-card border border-birch/50 bg-birch/10 p-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-2xl flex-shrink-0">💳</span>
        <div className="min-w-0">
          <p className="font-medium text-fjord">
            {count === 1
              ? 'Identify your credit card to unlock benefits tracking'
              : `Identify ${count} credit cards to unlock benefits tracking`}
          </p>
          <p className="text-sm text-stone mt-0.5">
            Track perks, annual fee value, and optimize your card usage
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          href="/accounts/benefits"
          className="btn-secondary text-sm whitespace-nowrap"
        >
          Link cards
        </Link>
        <button
          onClick={dismiss}
          className="text-stone hover:text-midnight p-1"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  )
}
