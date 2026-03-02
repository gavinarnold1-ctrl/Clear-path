'use client'

import { useState } from 'react'
import Link from 'next/link'

const STEP_MESSAGES: Record<number, string> = {
  0: 'Tell us about your financial goal so we can personalize your experience.',
  1: 'Set up your household for better tracking.',
  2: 'Share your income range for personalized benchmarks.',
}

export default function OnboardingBanner({ step }: { step: number }) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const message = STEP_MESSAGES[step] ?? STEP_MESSAGES[0]

  return (
    <div className="mb-6 flex items-center gap-3 rounded-lg border border-mist bg-frost px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-fjord">Complete your setup</p>
        <p className="text-sm text-fjord">{message}</p>
      </div>
      <Link
        href="/onboarding"
        className="shrink-0 rounded-md bg-fjord px-3 py-1.5 text-sm font-medium text-snow hover:bg-midnight transition"
      >
        Continue
      </Link>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 text-stone hover:text-fjord"
        aria-label="Dismiss banner"
      >
        &times;
      </button>
    </div>
  )
}
