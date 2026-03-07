'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { saveOnboardingStep, completeOnboarding, skipOnboarding } from '@/app/actions/onboarding'
import { trackOnboardingStep, trackOnboardingComplete, trackGoalSet, trackSignup } from '@/lib/analytics'
import type {
  OnboardingAnswers,
  PrimaryGoal,
  HouseholdType,
  IncomeRange,
} from '@/types'

// ─── Constants ─────────────────────────────────────────────────────────────────

const GOAL_OPTIONS: { key: PrimaryGoal; label: string; description: string }[] = [
  { key: 'save_more', label: 'Save More', description: 'Build your savings cushion' },
  { key: 'spend_smarter', label: 'Spend Smarter', description: 'Get more value from every dollar' },
  { key: 'pay_off_debt', label: 'Pay Off Debt', description: 'Accelerate your path to debt-free' },
  { key: 'gain_visibility', label: 'Gain Visibility', description: 'Finally see where your money goes' },
  { key: 'build_wealth', label: 'Build Wealth', description: 'Grow your net worth over time' },
]

const HOUSEHOLD_OPTIONS: { key: HouseholdType; label: string }[] = [
  { key: 'single', label: 'Just me' },
  { key: 'shared_partner', label: 'Me and a partner (shared finances)' },
  { key: 'separate_partner', label: 'Me and a partner (separate finances)' },
  { key: 'family', label: 'Family with dependents' },
]

const INCOME_OPTIONS: { key: IncomeRange; label: string }[] = [
  { key: 'under_50k', label: 'Under $50K' },
  { key: '50k_100k', label: '$50K \u2013 $100K' },
  { key: '100k_150k', label: '$100K \u2013 $150K' },
  { key: '150k_200k', label: '$150K \u2013 $200K' },
  { key: '200k_300k', label: '$200K \u2013 $300K' },
  { key: 'over_300k', label: 'Over $300K' },
]

const TOTAL_STEPS = 3

// ─── Component ─────────────────────────────────────────────────────────────────

interface Props {
  initialStep: number
  initialAnswers: OnboardingAnswers
}

export default function OnboardingWizard({ initialStep, initialAnswers }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(Math.min(initialStep, TOTAL_STEPS - 1))
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Track signup for new users landing on onboarding
  useEffect(() => {
    if (initialStep === 0 && !initialAnswers.primaryGoal) {
      trackSignup('email')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Q1: Goal
  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoal | null>(initialAnswers.primaryGoal)
  // Q2: Household
  const [householdType, setHouseholdType] = useState<HouseholdType | null>(initialAnswers.householdType)
  const [partnerName, setPartnerName] = useState(initialAnswers.partnerName ?? '')
  // Q3: Income Range
  const [incomeRange, setIncomeRange] = useState<IncomeRange | null>(initialAnswers.incomeRange)

  const showPartnerInput = householdType && householdType !== 'single'

  const canProceed = useCallback((): boolean => {
    switch (step) {
      case 0: return primaryGoal !== null
      case 1: return householdType !== null && (!showPartnerInput || partnerName.trim().length > 0)
      case 2: return incomeRange !== null
      default: return false
    }
  }, [step, primaryGoal, householdType, showPartnerInput, partnerName, incomeRange])

  const currentAnswers = useCallback((): Partial<OnboardingAnswers> => {
    switch (step) {
      case 0: return { primaryGoal }
      case 1: return { householdType, partnerName: partnerName.trim() || null }
      case 2: return { incomeRange }
      default: return {}
    }
  }, [step, primaryGoal, householdType, partnerName, incomeRange])

  async function handleNext() {
    if (!canProceed()) return
    setSaving(true)
    try {
      await saveOnboardingStep(step + 1, currentAnswers())
      const stepNames = ['goal', 'household', 'income']
      trackOnboardingStep(step + 1, stepNames[step] ?? `step_${step}`, currentAnswers())
      if (step === 0 && primaryGoal) {
        trackGoalSet(primaryGoal, 'onboarding')
      }
      if (step < TOTAL_STEPS - 1) {
        setStep(step + 1)
      }
    } finally {
      setSaving(false)
    }
  }

  function handleBack() {
    if (step > 0) setStep(step - 1)
  }

  async function handleSubmit() {
    if (!canProceed()) return
    setSubmitting(true)
    try {
      const allAnswers: OnboardingAnswers = {
        primaryGoal,
        householdType,
        partnerName: partnerName.trim() || null,
        incomeRange,
      }
      const result = await completeOnboarding(allAnswers)
      if (result.error) {
        toast.error(result.error)
        return
      }
      trackOnboardingComplete(0, primaryGoal ?? 'none')
      router.push('/dashboard')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSkip() {
    await skipOnboarding()
  }

  const isLastStep = step === TOTAL_STEPS - 1

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      {/* Progress indicator */}
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between text-sm text-stone">
          <span>Step {step + 1} of {TOTAL_STEPS}</span>
          <button
            type="button"
            onClick={handleSkip}
            className="text-stone hover:text-stone underline"
          >
            Skip for now
          </button>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-mist">
          <div
            className="h-full rounded-full bg-fjord transition-all duration-300"
            style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </div>

      {/* Step content */}
      <div className="card">
        {step === 0 && (
          <StepGoal value={primaryGoal} onChange={setPrimaryGoal} />
        )}
        {step === 1 && (
          <StepHousehold
            value={householdType}
            onChange={setHouseholdType}
            partnerName={partnerName}
            onPartnerNameChange={setPartnerName}
            showPartnerInput={!!showPartnerInput}
          />
        )}
        {step === 2 && (
          <StepIncome value={incomeRange} onChange={setIncomeRange} />
        )}
      </div>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        {step > 0 ? (
          <Button variant="secondary" type="button" onClick={handleBack}>
            Back
          </Button>
        ) : (
          <div />
        )}
        {isLastStep ? (
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canProceed()}
            loading={submitting}
            loadingText="Setting up..."
          >
            Finish
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleNext}
            disabled={!canProceed()}
            loading={saving}
            loadingText="Saving..."
          >
            Continue
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Step sub-components ─────────────────────────────────────────────────────

function StepGoal({ value, onChange }: { value: PrimaryGoal | null; onChange: (v: PrimaryGoal) => void }) {
  return (
    <div>
      <h2 className="mb-1 text-xl font-bold text-fjord">What matters most for your money right now?</h2>
      <p className="mb-6 text-sm text-stone">
        This drives everything &mdash; your budget suggestions, insights, and progress tracking.
      </p>
      <div className="space-y-2">
        {GOAL_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={`w-full rounded-card border px-4 py-4 text-left transition ${
              value === opt.key
                ? 'border-pine bg-frost text-midnight'
                : 'border-mist text-fjord hover:border-lichen hover:bg-snow'
            }`}
          >
            <span className="block text-sm font-semibold">{opt.label}</span>
            <span className="block text-xs text-stone mt-0.5">{opt.description}</span>
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs text-stone">You can always change this later.</p>
    </div>
  )
}

function StepHousehold({
  value,
  onChange,
  partnerName,
  onPartnerNameChange,
  showPartnerInput,
}: {
  value: HouseholdType | null
  onChange: (v: HouseholdType) => void
  partnerName: string
  onPartnerNameChange: (v: string) => void
  showPartnerInput: boolean
}) {
  return (
    <div>
      <h2 className="mb-1 text-xl font-bold text-fjord">Who are you budgeting for?</h2>
      <p className="mb-6 text-sm text-stone">Helps us set up the right tracking features.</p>
      <div className="space-y-2">
        {HOUSEHOLD_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={`w-full rounded-card border px-4 py-3 text-left text-sm font-medium transition ${
              value === opt.key
                ? 'border-pine bg-frost text-midnight'
                : 'border-mist text-fjord hover:border-lichen hover:bg-snow'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {showPartnerInput && (
        <div className="mt-4">
          <label htmlFor="partner-name" className="mb-1 block text-sm font-medium text-fjord">
            What&apos;s their first name?
          </label>
          <input
            id="partner-name"
            type="text"
            value={partnerName}
            onChange={(e) => onPartnerNameChange(e.target.value)}
            placeholder="e.g., Caroline"
            className="input"
            autoFocus
          />
        </div>
      )}
    </div>
  )
}

function StepIncome({ value, onChange }: { value: IncomeRange | null; onChange: (v: IncomeRange) => void }) {
  return (
    <div>
      <h2 className="mb-1 text-xl font-bold text-fjord">What&apos;s your household&apos;s approximate income?</h2>
      <p className="mb-6 text-sm text-stone">
        This helps us personalize your benchmarks. We never store your exact salary.
      </p>
      <div className="space-y-2">
        {INCOME_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={`w-full rounded-card border px-4 py-3 text-left text-sm font-medium transition ${
              value === opt.key
                ? 'border-pine bg-frost text-midnight'
                : 'border-mist text-fjord hover:border-lichen hover:bg-snow'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
