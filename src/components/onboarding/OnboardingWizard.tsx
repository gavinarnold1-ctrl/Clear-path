'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { saveOnboardingStep, completeOnboarding, skipOnboarding } from '@/app/actions/onboarding'
import type {
  OnboardingAnswers,
  OnboardingAccountEntry,
  OnboardingPropertyEntry,
  PrimaryGoal,
  HouseholdType,
  DebtLevel,
  CategoryMode,
  AccountType,
} from '@/types'

// ─── Constants ─────────────────────────────────────────────────────────────────

const GOAL_OPTIONS: { key: PrimaryGoal; label: string }[] = [
  { key: 'debt_payoff', label: 'Pay off debt faster' },
  { key: 'emergency_savings', label: 'Build emergency savings' },
  { key: 'major_purchase', label: 'Save for a major purchase' },
  { key: 'invest', label: 'Invest & grow wealth' },
  { key: 'organize', label: 'Just get organized' },
]

const HOUSEHOLD_OPTIONS: { key: HouseholdType; label: string }[] = [
  { key: 'single', label: 'Just me' },
  { key: 'shared_partner', label: 'Me and a partner (shared finances)' },
  { key: 'separate_partner', label: 'Me and a partner (separate finances)' },
  { key: 'family', label: 'Family with dependents' },
]

const ACCOUNT_TYPE_CHIPS: { key: AccountType; label: string; placeholder: string }[] = [
  { key: 'CHECKING', label: 'Checking', placeholder: 'e.g., Chase Checking' },
  { key: 'SAVINGS', label: 'Savings', placeholder: 'e.g., Ally Savings' },
  { key: 'CREDIT_CARD', label: 'Credit Card', placeholder: 'e.g., Chase Sapphire' },
  { key: 'MORTGAGE', label: 'Mortgage', placeholder: 'e.g., Wells Fargo Mortgage' },
  { key: 'AUTO_LOAN', label: 'Auto Loan', placeholder: 'e.g., Auto Loan' },
  { key: 'STUDENT_LOAN', label: 'Student Loan', placeholder: 'e.g., Federal Student Loan' },
  { key: 'INVESTMENT', label: 'Investment', placeholder: 'e.g., Fidelity 401k' },
]

const DEBT_OPTIONS: { key: DebtLevel; label: string }[] = [
  { key: 'minimal', label: 'Debt-free (or just a mortgage)' },
  { key: 'credit_cards', label: 'Some credit card balances' },
  { key: 'student_loans', label: 'Student loans' },
  { key: 'multiple', label: 'Multiple debts I\'m managing' },
]

const CATEGORY_OPTIONS: { key: CategoryMode; label: string; desc: string }[] = [
  { key: 'recommended', label: 'Use recommended categories', desc: 'Pre-built set of common spending categories' },
  { key: 'custom', label: 'Start from scratch', desc: 'Build your own categories as you go' },
  { key: 'import_match', label: 'I\'m importing from Monarch or Mint', desc: 'Categories auto-created from your CSV export' },
]

const TOTAL_STEPS = 6

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

  // Q1
  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoal | null>(initialAnswers.primaryGoal)
  // Q2
  const [householdType, setHouseholdType] = useState<HouseholdType | null>(initialAnswers.householdType)
  const [partnerName, setPartnerName] = useState(initialAnswers.partnerName ?? '')
  // Q3
  const [accounts, setAccounts] = useState<OnboardingAccountEntry[]>(
    initialAnswers.accounts.length > 0 ? initialAnswers.accounts : []
  )
  // Q4
  const [hasRental, setHasRental] = useState<boolean | null>(
    initialAnswers.hasRentalProperty ? true : initialStep > 3 ? false : null
  )
  const [properties, setProperties] = useState<OnboardingPropertyEntry[]>(
    initialAnswers.properties.length > 0 ? initialAnswers.properties : []
  )
  // Q5
  const [debtLevel, setDebtLevel] = useState<DebtLevel | null>(initialAnswers.debtLevel)
  // Q6
  const [categoryMode, setCategoryMode] = useState<CategoryMode | null>(initialAnswers.categoryMode)

  const showPartnerInput = householdType && householdType !== 'single'

  const canProceed = useCallback((): boolean => {
    switch (step) {
      case 0: return primaryGoal !== null
      case 1: return householdType !== null && (!showPartnerInput || partnerName.trim().length > 0)
      case 2: return accounts.length > 0 && accounts.every((a) => a.name.trim().length > 0)
      case 3: return hasRental !== null
      case 4: return debtLevel !== null
      case 5: return categoryMode !== null
      default: return false
    }
  }, [step, primaryGoal, householdType, showPartnerInput, partnerName, accounts, hasRental, debtLevel, categoryMode])

  const currentAnswers = useCallback((): Partial<OnboardingAnswers> => {
    switch (step) {
      case 0: return { primaryGoal }
      case 1: return { householdType, partnerName: partnerName.trim() || null }
      case 2: return { accounts }
      case 3: return { hasRentalProperty: hasRental ?? false, properties }
      case 4: return { debtLevel }
      case 5: return { categoryMode }
      default: return {}
    }
  }, [step, primaryGoal, householdType, partnerName, accounts, hasRental, properties, debtLevel, categoryMode])

  async function handleNext() {
    if (!canProceed()) return
    setSaving(true)
    try {
      await saveOnboardingStep(step + 1, currentAnswers())
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
        accounts,
        hasRentalProperty: hasRental ?? false,
        rentalCount: properties.length,
        properties,
        debtLevel,
        categoryMode,
      }
      const result = await completeOnboarding(allAnswers)
      if (result.error) {
        alert(result.error)
        return
      }
      if (result.categoryMode === 'import_match') {
        router.push('/transactions/import')
      } else {
        router.push('/dashboard')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSkip() {
    await skipOnboarding()
  }

  // ─── Account management (Q3) ──────────────────────────────────────────────

  function addAccount(type: AccountType) {
    const chip = ACCOUNT_TYPE_CHIPS.find((c) => c.key === type)
    setAccounts([...accounts, { name: '', type }])
    // Auto-focus happens via key-based rendering
    void chip // satisfy lint
  }

  function updateAccountName(index: number, name: string) {
    const updated = [...accounts]
    updated[index] = { ...updated[index], name }
    setAccounts(updated)
  }

  function removeAccount(index: number) {
    setAccounts(accounts.filter((_, i) => i !== index))
  }

  // ─── Property management (Q4) ─────────────────────────────────────────────

  function addProperty() {
    setProperties([...properties, { name: '' }])
  }

  function updatePropertyName(index: number, name: string) {
    const updated = [...properties]
    updated[index] = { name }
    setProperties(updated)
  }

  function removeProperty(index: number) {
    setProperties(properties.filter((_, i) => i !== index))
  }

  // ─── Step content renderers ───────────────────────────────────────────────

  const isLastStep = step === TOTAL_STEPS - 1

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      {/* Progress indicator */}
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between text-sm text-gray-500">
          <span>Step {step + 1} of {TOTAL_STEPS}</span>
          <button
            type="button"
            onClick={handleSkip}
            className="text-gray-400 hover:text-gray-600 underline"
          >
            Skip for now
          </button>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-brand-500 transition-all duration-300"
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
          <StepAccounts
            accounts={accounts}
            onAdd={addAccount}
            onUpdateName={updateAccountName}
            onRemove={removeAccount}
          />
        )}
        {step === 3 && (
          <StepRental
            hasRental={hasRental}
            onHasRentalChange={(val) => {
              setHasRental(val)
              if (val && properties.length === 0) addProperty()
              if (!val) setProperties([])
            }}
            properties={properties}
            onAddProperty={addProperty}
            onUpdatePropertyName={updatePropertyName}
            onRemoveProperty={removeProperty}
          />
        )}
        {step === 4 && (
          <StepDebt value={debtLevel} onChange={setDebtLevel} />
        )}
        {step === 5 && (
          <StepCategories value={categoryMode} onChange={setCategoryMode} />
        )}
      </div>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        {step > 0 ? (
          <button type="button" onClick={handleBack} className="btn-secondary">
            Back
          </button>
        ) : (
          <div />
        )}
        {isLastStep ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canProceed() || submitting}
            className="btn-primary disabled:opacity-50"
          >
            {submitting ? 'Setting up...' : 'Finish'}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            disabled={!canProceed() || saving}
            className="btn-primary disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Continue'}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Step sub-components ─────────────────────────────────────────────────────

function StepGoal({ value, onChange }: { value: PrimaryGoal | null; onChange: (v: PrimaryGoal) => void }) {
  return (
    <div>
      <h2 className="mb-1 text-xl font-bold text-gray-900">What&apos;s your #1 financial priority right now?</h2>
      <p className="mb-6 text-sm text-gray-500">This helps us tailor your experience.</p>
      <div className="space-y-2">
        {GOAL_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={`w-full rounded-lg border px-4 py-3 text-left text-sm font-medium transition ${
              value === opt.key
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
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
      <h2 className="mb-1 text-xl font-bold text-gray-900">Who&apos;s part of your financial household?</h2>
      <p className="mb-6 text-sm text-gray-500">Helps us set up the right tracking features.</p>
      <div className="space-y-2">
        {HOUSEHOLD_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={`w-full rounded-lg border px-4 py-3 text-left text-sm font-medium transition ${
              value === opt.key
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {showPartnerInput && (
        <div className="mt-4">
          <label htmlFor="partner-name" className="mb-1 block text-sm font-medium text-gray-700">
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

function StepAccounts({
  accounts,
  onAdd,
  onUpdateName,
  onRemove,
}: {
  accounts: OnboardingAccountEntry[]
  onAdd: (type: AccountType) => void
  onUpdateName: (index: number, name: string) => void
  onRemove: (index: number) => void
}) {
  return (
    <div>
      <h2 className="mb-1 text-xl font-bold text-gray-900">What financial accounts do you use?</h2>
      <p className="mb-6 text-sm text-gray-500">
        We&apos;ll set these up so your imports match automatically.
      </p>

      {/* Chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        {ACCOUNT_TYPE_CHIPS.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => onAdd(chip.key)}
            className="rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 transition"
          >
            + {chip.label}
          </button>
        ))}
      </div>

      {/* Added accounts */}
      {accounts.length > 0 && (
        <div className="space-y-2">
          {accounts.map((acct, i) => {
            const chip = ACCOUNT_TYPE_CHIPS.find((c) => c.key === acct.type)
            return (
              <div key={`${acct.type}-${i}`} className="flex items-center gap-2">
                <span className="shrink-0 rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                  {chip?.label ?? acct.type}
                </span>
                <input
                  type="text"
                  value={acct.name}
                  onChange={(e) => onUpdateName(i, e.target.value)}
                  placeholder={chip?.placeholder ?? 'Account name'}
                  className="input flex-1"
                  autoFocus={i === accounts.length - 1 && acct.name === ''}
                />
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  className="shrink-0 text-gray-400 hover:text-red-500"
                  aria-label="Remove account"
                >
                  &times;
                </button>
              </div>
            )
          })}
        </div>
      )}

      {accounts.length === 0 && (
        <p className="text-sm text-gray-400">Tap a chip above to add an account. At least one is required.</p>
      )}
    </div>
  )
}

function StepRental({
  hasRental,
  onHasRentalChange,
  properties,
  onAddProperty,
  onUpdatePropertyName,
  onRemoveProperty,
}: {
  hasRental: boolean | null
  onHasRentalChange: (v: boolean) => void
  properties: OnboardingPropertyEntry[]
  onAddProperty: () => void
  onUpdatePropertyName: (index: number, name: string) => void
  onRemoveProperty: (index: number) => void
}) {
  return (
    <div>
      <h2 className="mb-1 text-xl font-bold text-gray-900">Do you own rental or investment property?</h2>
      <p className="mb-6 text-sm text-gray-500">
        We&apos;ll set up tax-relevant categories for property expenses.
      </p>
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => onHasRentalChange(false)}
          className={`w-full rounded-lg border px-4 py-3 text-left text-sm font-medium transition ${
            hasRental === false
              ? 'border-brand-500 bg-brand-50 text-brand-700'
              : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          No
        </button>
        <button
          type="button"
          onClick={() => onHasRentalChange(true)}
          className={`w-full rounded-lg border px-4 py-3 text-left text-sm font-medium transition ${
            hasRental === true
              ? 'border-brand-500 bg-brand-50 text-brand-700'
              : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          Yes
        </button>
      </div>

      {hasRental && (
        <div className="mt-4 space-y-2">
          <p className="mb-2 text-sm font-medium text-gray-700">Give each property a nickname:</p>
          {properties.map((prop, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={prop.name}
                onChange={(e) => onUpdatePropertyName(i, e.target.value)}
                placeholder="e.g., Nicoll St Duplex"
                className="input flex-1"
                autoFocus={i === properties.length - 1 && prop.name === ''}
              />
              {properties.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemoveProperty(i)}
                  className="shrink-0 text-gray-400 hover:text-red-500"
                  aria-label="Remove property"
                >
                  &times;
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={onAddProperty}
            className="text-sm text-brand-600 hover:text-brand-700"
          >
            + Add another property
          </button>
        </div>
      )}
    </div>
  )
}

function StepDebt({ value, onChange }: { value: DebtLevel | null; onChange: (v: DebtLevel) => void }) {
  return (
    <div>
      <h2 className="mb-1 text-xl font-bold text-gray-900">What&apos;s your current debt situation?</h2>
      <p className="mb-6 text-sm text-gray-500">
        No need for details now — you can enter specifics later in the Debt module.
      </p>
      <div className="space-y-2">
        {DEBT_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={`w-full rounded-lg border px-4 py-3 text-left text-sm font-medium transition ${
              value === opt.key
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function StepCategories({ value, onChange }: { value: CategoryMode | null; onChange: (v: CategoryMode) => void }) {
  return (
    <div>
      <h2 className="mb-1 text-xl font-bold text-gray-900">How would you like to organize your spending categories?</h2>
      <p className="mb-6 text-sm text-gray-500">You can always add or change categories later.</p>
      <div className="space-y-2">
        {CATEGORY_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={`w-full rounded-lg border px-4 py-3 text-left transition ${
              value === opt.key
                ? 'border-brand-500 bg-brand-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <span className={`block text-sm font-medium ${value === opt.key ? 'text-brand-700' : 'text-gray-700'}`}>
              {opt.label}
            </span>
            <span className="block text-xs text-gray-500">{opt.desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
