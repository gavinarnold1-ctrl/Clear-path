'use client'

import { useState } from 'react'
import Link from 'next/link'

const STEP_MESSAGES: Record<number, string> = {
  0: 'Tell us about your goals so we can personalize your experience.',
  1: 'Set up your household for better tracking.',
  2: 'Add your accounts so imports match automatically.',
  3: 'Let us know about your property for tax-relevant categories.',
  4: 'Share your debt situation for smarter recommendations.',
  5: 'Choose how to organize your spending categories.',
}

export default function OnboardingBanner({ step }: { step: number }) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const message = STEP_MESSAGES[step] ?? STEP_MESSAGES[0]

  return (
    <div className="mb-6 flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-brand-800">Complete your setup</p>
        <p className="text-sm text-brand-600">{message}</p>
      </div>
      <Link
        href="/onboarding"
        className="shrink-0 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 transition"
      >
        Continue
      </Link>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 text-brand-400 hover:text-brand-600"
        aria-label="Dismiss banner"
      >
        &times;
      </button>
    </div>
  )
}
