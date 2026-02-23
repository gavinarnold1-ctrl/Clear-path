import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getOnboardingState } from '@/app/actions/onboarding'
import OnboardingWizard from '@/components/onboarding/OnboardingWizard'
import type { OnboardingAnswers } from '@/types'

export const metadata: Metadata = { title: 'Get Started — Clear-path' }

const EMPTY_ANSWERS: OnboardingAnswers = {
  primaryGoal: null,
  householdType: null,
  partnerName: null,
  accounts: [],
  hasRentalProperty: false,
  rentalCount: 0,
  properties: [],
  debtLevel: null,
  categoryMode: null,
}

export default async function OnboardingPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const state = await getOnboardingState()

  // Already completed — send to dashboard
  if (state?.completed) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-snow">
      <OnboardingWizard
        initialStep={state?.step ?? 0}
        initialAnswers={state?.answers ?? EMPTY_ANSWERS}
      />
    </div>
  )
}
