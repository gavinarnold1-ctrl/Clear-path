'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { pitiBreakdown } from '@/lib/engines/amortization'
import type { PITIBreakdown } from '@/lib/engines/amortization'

// ─── Types ───────────────────────────────────────────────────────────────────

interface AccountOption {
  id: string
  name: string
  type: string
}

interface ExistingPropertyData {
  id: string
  name: string
  type: string
  address?: string | null
  currentValue?: number | null
  loanBalance?: number | null
  monthlyPayment?: number | null
  interestRate?: number | null
  loanTermMonths?: number | null
  loanStartDate?: string | null
  monthlyPropertyTax?: number | null
  monthlyInsurance?: number | null
  monthlyHOA?: number | null
  monthlyPMI?: number | null
  groupId?: string | null
  splitPct?: number | null
}

interface Props {
  isOpen: boolean
  onClose: () => void
  accounts: AccountOption[]
  existingProperty?: ExistingPropertyData | null
}

type PropertyTypeValue = 'PERSONAL' | 'RENTAL' | 'BUSINESS'
type EscrowType = 'full' | 'taxes-only' | 'none'
type UnitUse = 'owner-occupied' | 'rented' | 'vacant'

interface UnitConfig {
  name: string
  use: UnitUse
}

const VALID_TYPES: { value: PropertyTypeValue; label: string }[] = [
  { value: 'PERSONAL', label: 'Personal Home' },
  { value: 'RENTAL', label: 'Rental Property' },
  { value: 'BUSINESS', label: 'Business' },
]

const TAX_SCHEDULE_MAP: Record<string, string> = {
  PERSONAL: 'Schedule A',
  RENTAL: 'Schedule E',
  BUSINESS: 'Schedule C',
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n)
}

// ─── Wizard Component ────────────────────────────────────────────────────────

export default function PropertySetupWizard({ isOpen, onClose, accounts, existingProperty }: Props) {
  const router = useRouter()
  const isEditMode = !!existingProperty

  // Step state
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [createdPropertyId, setCreatedPropertyId] = useState<string | null>(null)

  // Step 0: Basic Info
  const [name, setName] = useState(existingProperty?.name ?? '')
  const [propertyType, setPropertyType] = useState<PropertyTypeValue>(
    (existingProperty?.type as PropertyTypeValue) ?? 'PERSONAL',
  )
  const [isMultiUnit, setIsMultiUnit] = useState(false)
  const [unitCount, setUnitCount] = useState(2)
  const [units, setUnits] = useState<UnitConfig[]>([
    { name: 'Unit 1', use: 'owner-occupied' },
    { name: 'Unit 2', use: 'rented' },
  ])
  const [address, setAddress] = useState(existingProperty?.address ?? '')

  // Step 1: Mortgage Details
  const hasMortgageFromExisting = existingProperty?.loanBalance != null && existingProperty.loanBalance > 0
  const [hasMortgage, setHasMortgage] = useState(hasMortgageFromExisting)
  const [loanBalance, setLoanBalance] = useState(existingProperty?.loanBalance?.toString() ?? '')
  const [interestRate, setInterestRate] = useState(
    existingProperty?.interestRate != null ? (existingProperty.interestRate * 100).toString() : '',
  )
  const [loanTermMonths, setLoanTermMonths] = useState(
    existingProperty?.loanTermMonths?.toString() ?? '360',
  )
  const [monthlyPayment, setMonthlyPayment] = useState(
    existingProperty?.monthlyPayment?.toString() ?? '',
  )
  const [loanStartDate, setLoanStartDate] = useState(
    existingProperty?.loanStartDate ? existingProperty.loanStartDate.split('T')[0] : '',
  )

  // Step 2: Escrow Configuration
  const hasEscrowFromExisting = existingProperty?.monthlyPropertyTax != null
  const [escrowType, setEscrowType] = useState<EscrowType>(
    hasEscrowFromExisting
      ? existingProperty?.monthlyInsurance != null && existingProperty.monthlyInsurance > 0
        ? 'full'
        : 'taxes-only'
      : 'full',
  )
  const [monthlyPropertyTax, setMonthlyPropertyTax] = useState(
    existingProperty?.monthlyPropertyTax?.toString() ?? '',
  )
  const [monthlyInsurance, setMonthlyInsurance] = useState(
    existingProperty?.monthlyInsurance?.toString() ?? '',
  )
  const [monthlyHOA, setMonthlyHOA] = useState(existingProperty?.monthlyHOA?.toString() ?? '')
  const [monthlyPMI, setMonthlyPMI] = useState(existingProperty?.monthlyPMI?.toString() ?? '')
  const [currentValue, setCurrentValue] = useState(
    existingProperty?.currentValue?.toString() ?? '',
  )

  // Step 3: Account Linking
  const [linkedAccountIds, setLinkedAccountIds] = useState<Set<string>>(new Set())

  // Derive active steps
  const activeSteps = useMemo(() => {
    const steps = ['Basic Info', 'Mortgage']
    if (hasMortgage) steps.push('Escrow')
    if (!isEditMode && accounts.length > 0) steps.push('Accounts')
    steps.push('Summary')
    return steps
  }, [hasMortgage, isEditMode, accounts.length])

  const totalSteps = activeSteps.length
  const isLastStep = step === totalSteps - 1

  // ─── PITI Calculation ────────────────────────────────────────────────────

  const pitiResult: PITIBreakdown | null = useMemo(() => {
    if (!hasMortgage) return null
    const bal = parseFloat(loanBalance) || 0
    const rate = (parseFloat(interestRate) || 0) / 100
    const pmt = parseFloat(monthlyPayment) || 0
    const tax = parseFloat(monthlyPropertyTax) || 0
    const ins = parseFloat(monthlyInsurance) || 0
    const hoa = parseFloat(monthlyHOA) || 0
    const pmi = parseFloat(monthlyPMI) || 0
    if (bal <= 0 || pmt <= 0) return null
    return pitiBreakdown(bal, rate, pmt, tax, ins, hoa, pmi)
  }, [hasMortgage, loanBalance, interestRate, monthlyPayment, monthlyPropertyTax, monthlyInsurance, monthlyHOA, monthlyPMI])

  // Payment validation: escrow + P&I should match total payment ±$5
  const paymentMismatch = useMemo(() => {
    if (!pitiResult || !hasMortgage) return null
    const total = pitiResult.principal + pitiResult.interest + pitiResult.escrowTotal
    const pmt = parseFloat(monthlyPayment) || 0
    const diff = Math.abs(total - pmt)
    if (diff > 5) return diff
    return null
  }, [pitiResult, hasMortgage, monthlyPayment])

  // ─── Step Validation ─────────────────────────────────────────────────────

  const canProceed = useCallback((): boolean => {
    const currentStepName = activeSteps[step]
    switch (currentStepName) {
      case 'Basic Info':
        if (!name.trim()) return false
        if (isMultiUnit && propertyType !== 'BUSINESS') {
          return units.every((u) => u.name.trim() !== '')
        }
        return true
      case 'Mortgage':
        if (!hasMortgage) return true
        return !!(
          parseFloat(loanBalance) > 0 &&
          parseFloat(interestRate) >= 0 &&
          parseInt(loanTermMonths, 10) > 0 &&
          parseFloat(monthlyPayment) > 0
        )
      case 'Escrow':
        return true // All escrow fields optional
      case 'Accounts':
        return true // Optional step
      case 'Summary':
        return true
      default:
        return true
    }
  }, [step, activeSteps, name, isMultiUnit, propertyType, units, hasMortgage, loanBalance, interestRate, loanTermMonths, monthlyPayment])

  // ─── Unit Config Helpers ─────────────────────────────────────────────────

  function handleUnitCountChange(count: number) {
    setUnitCount(count)
    const newUnits: UnitConfig[] = []
    for (let i = 0; i < count; i++) {
      newUnits.push(units[i] ?? { name: `Unit ${i + 1}`, use: i === 0 ? 'owner-occupied' : 'rented' })
    }
    setUnits(newUnits)
  }

  function updateUnit(index: number, field: keyof UnitConfig, value: string) {
    setUnits((prev) =>
      prev.map((u, i) => (i === index ? { ...u, [field]: value } : u)),
    )
  }

  // ─── Account Link Toggle ────────────────────────────────────────────────

  function toggleAccountLink(accountId: string) {
    setLinkedAccountIds((prev) => {
      const next = new Set(prev)
      if (next.has(accountId)) {
        next.delete(accountId)
      } else {
        next.add(accountId)
      }
      return next
    })
  }

  // ─── Submit Logic ────────────────────────────────────────────────────────

  async function handleSubmit() {
    setSaving(true)
    setError(null)

    try {
      if (isEditMode && existingProperty) {
        // Edit mode: PATCH the existing property
        await patchProperty(existingProperty.id)
      } else if (isMultiUnit && propertyType !== 'BUSINESS') {
        // Multi-unit: create group + units
        await createMultiUnitProperty()
      } else {
        // Single property: create then patch with financials
        await createSingleProperty()
      }
      setSuccess(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  async function createSingleProperty() {
    // Step 1: Create the property
    const createRes = await fetch('/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        type: propertyType,
        address: address.trim() || null,
      }),
    })
    if (!createRes.ok) {
      const data = await createRes.json()
      throw new Error(data.error ?? 'Failed to create property')
    }
    const property = await createRes.json()
    setCreatedPropertyId(property.id)

    // Step 2: Add financial details if mortgage exists
    if (hasMortgage) {
      await patchProperty(property.id)
    }

    // Step 3: Link accounts
    await linkAccounts(property.id)
  }

  async function createMultiUnitProperty() {
    // Step 1: Create PropertyGroup
    const groupRes = await fetch('/api/property-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        description: `${unitCount}-unit property`,
      }),
    })
    if (!groupRes.ok) {
      const data = await groupRes.json()
      throw new Error(data.error ?? 'Failed to create property group')
    }
    const group = await groupRes.json()

    // Step 2: Create each unit
    const splitPct = Math.round((100 / unitCount) * 100) / 100
    const createdUnits: { id: string; name: string; use: UnitUse }[] = []

    for (let i = 0; i < units.length; i++) {
      const unit = units[i]
      const unitType: PropertyTypeValue = unit.use === 'rented' ? 'RENTAL' : propertyType
      const unitTaxSchedule =
        unit.use === 'owner-occupied' ? 'SCHEDULE_A' :
          unit.use === 'rented' ? 'SCHEDULE_E' : undefined

      const unitRes = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${name.trim()} - ${unit.name.trim()}`,
          type: unitType,
          address: address.trim() || null,
          groupId: group.id,
          splitPct,
          ...(unitTaxSchedule && { taxSchedule: unitTaxSchedule }),
        }),
      })
      if (!unitRes.ok) {
        const data = await unitRes.json()
        throw new Error(data.error ?? `Failed to create unit ${unit.name}`)
      }
      const unitProp = await unitRes.json()
      createdUnits.push({ id: unitProp.id, name: unit.name, use: unit.use })
    }

    // Step 3: Set split rules
    await fetch('/api/split-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupId: group.id,
        allocations: createdUnits.map((u) => ({
          propertyId: u.id,
          allocationPct: splitPct,
        })),
      }),
    })

    // Step 4: Add financial details to each unit (proportional)
    if (hasMortgage) {
      for (const unit of createdUnits) {
        await patchProperty(unit.id, splitPct / 100)
      }
    }

    // Step 5: Link accounts to first unit
    if (createdUnits.length > 0) {
      await linkAccounts(createdUnits[0].id)
      setCreatedPropertyId(createdUnits[0].id)
    }
  }

  async function patchProperty(propertyId: string, scaleFactor = 1) {
    const body: Record<string, unknown> = {}

    if (currentValue) body.currentValue = (parseFloat(currentValue) || 0) * scaleFactor
    if (hasMortgage) {
      body.loanBalance = (parseFloat(loanBalance) || 0) * scaleFactor
      body.interestRate = (parseFloat(interestRate) || 0) / 100
      body.loanTermMonths = parseInt(loanTermMonths, 10) || 360
      body.monthlyPayment = (parseFloat(monthlyPayment) || 0) * scaleFactor
      if (loanStartDate) body.loanStartDate = loanStartDate

      body.monthlyPropertyTax = (parseFloat(monthlyPropertyTax) || 0) * scaleFactor
      body.monthlyInsurance = (parseFloat(monthlyInsurance) || 0) * scaleFactor
      body.monthlyHOA = (parseFloat(monthlyHOA) || 0) * scaleFactor
      body.monthlyPMI = (parseFloat(monthlyPMI) || 0) * scaleFactor
    }

    if (Object.keys(body).length === 0) return

    const res = await fetch(`/api/properties/${propertyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error ?? 'Failed to save financial details')
    }
  }

  async function linkAccounts(propertyId: string) {
    for (const accountId of linkedAccountIds) {
      try {
        await fetch('/api/account-property-links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId, propertyId }),
        })
      } catch {
        // Non-critical — don't block on account linking failures
      }
    }
  }

  // ─── Navigation ──────────────────────────────────────────────────────────

  function handleNext() {
    if (!canProceed()) return
    if (isLastStep) {
      handleSubmit()
    } else {
      setStep((s) => s + 1)
    }
  }

  function handleBack() {
    if (step > 0) setStep((s) => s - 1)
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-lg rounded-xl bg-frost p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {success ? (
          <SuccessScreen
            isMultiUnit={isMultiUnit && propertyType !== 'BUSINESS'}
            name={name}
            onClose={onClose}
          />
        ) : (
          <>
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-fjord">
                {isEditMode ? 'Edit Property' : 'Add Property'}
              </h2>
              <button onClick={onClose} className="text-stone hover:text-fjord">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Progress bar */}
            <div className="mb-1 flex items-center justify-between text-xs text-stone">
              <span>{activeSteps[step]}</span>
              <span>Step {step + 1} of {totalSteps}</span>
            </div>
            <div className="mb-5 h-2 w-full overflow-hidden rounded-full bg-mist">
              <div
                className="h-full rounded-full bg-fjord transition-all duration-300"
                style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
              />
            </div>

            {/* Error */}
            {error && (
              <p className="mb-4 rounded-lg bg-ember/10 p-3 text-sm text-ember">{error}</p>
            )}

            {/* Step Content */}
            {activeSteps[step] === 'Basic Info' && (
              <StepBasicInfo
                name={name}
                setName={setName}
                propertyType={propertyType}
                setPropertyType={setPropertyType}
                isMultiUnit={isMultiUnit}
                setIsMultiUnit={setIsMultiUnit}
                unitCount={unitCount}
                handleUnitCountChange={handleUnitCountChange}
                units={units}
                updateUnit={updateUnit}
                address={address}
                setAddress={setAddress}
                isEditMode={isEditMode}
              />
            )}

            {activeSteps[step] === 'Mortgage' && (
              <StepMortgage
                hasMortgage={hasMortgage}
                setHasMortgage={setHasMortgage}
                loanBalance={loanBalance}
                setLoanBalance={setLoanBalance}
                interestRate={interestRate}
                setInterestRate={setInterestRate}
                loanTermMonths={loanTermMonths}
                setLoanTermMonths={setLoanTermMonths}
                monthlyPayment={monthlyPayment}
                setMonthlyPayment={setMonthlyPayment}
                loanStartDate={loanStartDate}
                setLoanStartDate={setLoanStartDate}
              />
            )}

            {activeSteps[step] === 'Escrow' && (
              <StepEscrow
                escrowType={escrowType}
                setEscrowType={setEscrowType}
                monthlyPropertyTax={monthlyPropertyTax}
                setMonthlyPropertyTax={setMonthlyPropertyTax}
                monthlyInsurance={monthlyInsurance}
                setMonthlyInsurance={setMonthlyInsurance}
                monthlyHOA={monthlyHOA}
                setMonthlyHOA={setMonthlyHOA}
                monthlyPMI={monthlyPMI}
                setMonthlyPMI={setMonthlyPMI}
                currentValue={currentValue}
                setCurrentValue={setCurrentValue}
                pitiResult={pitiResult}
                paymentMismatch={paymentMismatch}
              />
            )}

            {activeSteps[step] === 'Accounts' && (
              <StepAccountLinking
                accounts={accounts}
                linkedAccountIds={linkedAccountIds}
                toggleAccountLink={toggleAccountLink}
              />
            )}

            {activeSteps[step] === 'Summary' && (
              <StepSummary
                name={name}
                propertyType={propertyType}
                address={address}
                isMultiUnit={isMultiUnit && propertyType !== 'BUSINESS'}
                unitCount={unitCount}
                units={units}
                hasMortgage={hasMortgage}
                loanBalance={loanBalance}
                interestRate={interestRate}
                loanTermMonths={loanTermMonths}
                monthlyPayment={monthlyPayment}
                escrowType={escrowType}
                pitiResult={pitiResult}
                linkedAccountIds={linkedAccountIds}
                accounts={accounts}
              />
            )}

            {/* Navigation */}
            <div className="mt-6 flex justify-between">
              <button
                onClick={step === 0 ? onClose : handleBack}
                className="btn-secondary px-4 py-2 text-sm"
              >
                {step === 0 ? 'Cancel' : 'Back'}
              </button>
              <button
                onClick={handleNext}
                disabled={!canProceed() || saving}
                className="btn-primary px-5 py-2 text-sm disabled:opacity-50"
              >
                {saving ? 'Saving...' : isLastStep ? 'Confirm & Save' : 'Continue'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Step Components ─────────────────────────────────────────────────────────

function StepBasicInfo({
  name, setName,
  propertyType, setPropertyType,
  isMultiUnit, setIsMultiUnit,
  unitCount, handleUnitCountChange,
  units, updateUnit,
  address, setAddress,
  isEditMode,
}: {
  name: string; setName: (v: string) => void
  propertyType: PropertyTypeValue; setPropertyType: (v: PropertyTypeValue) => void
  isMultiUnit: boolean; setIsMultiUnit: (v: boolean) => void
  unitCount: number; handleUnitCountChange: (v: number) => void
  units: UnitConfig[]; updateUnit: (i: number, f: keyof UnitConfig, v: string) => void
  address: string; setAddress: (v: string) => void
  isEditMode: boolean
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-fjord">Property Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input w-full"
          placeholder="e.g. 123 Main St"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-fjord">Property Type *</label>
        <div className="grid grid-cols-3 gap-2">
          {VALID_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setPropertyType(t.value)}
              className={`rounded-button border px-3 py-2 text-sm font-medium transition-colors ${
                propertyType === t.value
                  ? 'border-fjord bg-fjord text-snow'
                  : 'border-mist bg-white text-fjord hover:border-fjord'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {propertyType !== 'BUSINESS' && !isEditMode && (
        <div>
          <label className="mb-1 block text-sm font-medium text-fjord">
            Is this a multi-unit property?
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setIsMultiUnit(false)}
              className={`flex-1 rounded-button border px-3 py-2 text-sm font-medium transition-colors ${
                !isMultiUnit
                  ? 'border-fjord bg-fjord text-snow'
                  : 'border-mist bg-white text-fjord hover:border-fjord'
              }`}
            >
              No, single unit
            </button>
            <button
              type="button"
              onClick={() => setIsMultiUnit(true)}
              className={`flex-1 rounded-button border px-3 py-2 text-sm font-medium transition-colors ${
                isMultiUnit
                  ? 'border-fjord bg-fjord text-snow'
                  : 'border-mist bg-white text-fjord hover:border-fjord'
              }`}
            >
              Yes, multi-unit
            </button>
          </div>
        </div>
      )}

      {isMultiUnit && propertyType !== 'BUSINESS' && !isEditMode && (
        <>
          <div>
            <label className="mb-1 block text-sm font-medium text-fjord">How many units?</label>
            <select
              value={unitCount}
              onChange={(e) => handleUnitCountChange(parseInt(e.target.value, 10))}
              className="input w-full"
            >
              <option value={2}>2 (Duplex)</option>
              <option value={3}>3 (Triplex)</option>
              <option value={4}>4 (Fourplex)</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-fjord">Unit Details</label>
            <div className="space-y-2">
              {units.map((unit, i) => (
                <div key={i} className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={unit.name}
                    onChange={(e) => updateUnit(i, 'name', e.target.value)}
                    className="input text-sm"
                    placeholder={`Unit ${i + 1}`}
                  />
                  <select
                    value={unit.use}
                    onChange={(e) => updateUnit(i, 'use', e.target.value)}
                    className="input text-sm"
                  >
                    <option value="owner-occupied">Owner-occupied</option>
                    <option value="rented">Rented</option>
                    <option value="vacant">Vacant</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-fjord">
          Address <span className="font-normal text-stone">(optional)</span>
        </label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="input w-full"
          placeholder="e.g. 123 Main St, Springfield, IL 62701"
        />
      </div>
    </div>
  )
}

function StepMortgage({
  hasMortgage, setHasMortgage,
  loanBalance, setLoanBalance,
  interestRate, setInterestRate,
  loanTermMonths, setLoanTermMonths,
  monthlyPayment, setMonthlyPayment,
  loanStartDate, setLoanStartDate,
}: {
  hasMortgage: boolean; setHasMortgage: (v: boolean) => void
  loanBalance: string; setLoanBalance: (v: string) => void
  interestRate: string; setInterestRate: (v: string) => void
  loanTermMonths: string; setLoanTermMonths: (v: string) => void
  monthlyPayment: string; setMonthlyPayment: (v: string) => void
  loanStartDate: string; setLoanStartDate: (v: string) => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-fjord">
          Do you have a mortgage on this property?
        </label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setHasMortgage(true)}
            className={`flex-1 rounded-button border px-3 py-2 text-sm font-medium transition-colors ${
              hasMortgage
                ? 'border-fjord bg-fjord text-snow'
                : 'border-mist bg-white text-fjord hover:border-fjord'
            }`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setHasMortgage(false)}
            className={`flex-1 rounded-button border px-3 py-2 text-sm font-medium transition-colors ${
              !hasMortgage
                ? 'border-fjord bg-fjord text-snow'
                : 'border-mist bg-white text-fjord hover:border-fjord'
            }`}
          >
            No mortgage
          </button>
        </div>
      </div>

      {hasMortgage && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-fjord">Current Loan Balance *</label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-stone">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={loanBalance}
                  onChange={(e) => setLoanBalance(e.target.value)}
                  className="input w-full pl-6"
                  placeholder="e.g. 280,000"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-fjord">Interest Rate (%) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                className="input w-full"
                placeholder="e.g. 4.85"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-fjord">Loan Term (months) *</label>
              <input
                type="number"
                min="1"
                value={loanTermMonths}
                onChange={(e) => setLoanTermMonths(e.target.value)}
                className="input w-full"
                placeholder="e.g. 360"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-fjord">Total Monthly Payment *</label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-stone">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={monthlyPayment}
                  onChange={(e) => setMonthlyPayment(e.target.value)}
                  className="input w-full pl-6"
                  placeholder="e.g. 2,100"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-fjord">
              Loan Start Date <span className="font-normal text-stone">(optional)</span>
            </label>
            <input
              type="date"
              value={loanStartDate}
              onChange={(e) => setLoanStartDate(e.target.value)}
              className="input w-full"
            />
          </div>
        </>
      )}

      {!hasMortgage && (
        <p className="rounded-lg border border-mist bg-white p-4 text-sm text-stone">
          No mortgage details needed. You can add this later by editing the property.
        </p>
      )}
    </div>
  )
}

function StepEscrow({
  escrowType, setEscrowType,
  monthlyPropertyTax, setMonthlyPropertyTax,
  monthlyInsurance, setMonthlyInsurance,
  monthlyHOA, setMonthlyHOA,
  monthlyPMI, setMonthlyPMI,
  currentValue, setCurrentValue,
  pitiResult, paymentMismatch,
}: {
  escrowType: EscrowType; setEscrowType: (v: EscrowType) => void
  monthlyPropertyTax: string; setMonthlyPropertyTax: (v: string) => void
  monthlyInsurance: string; setMonthlyInsurance: (v: string) => void
  monthlyHOA: string; setMonthlyHOA: (v: string) => void
  monthlyPMI: string; setMonthlyPMI: (v: string) => void
  currentValue: string; setCurrentValue: (v: string) => void
  pitiResult: PITIBreakdown | null
  paymentMismatch: number | null
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-fjord">
          How is your mortgage payment structured?
        </label>
        <div className="space-y-2">
          {[
            { value: 'full' as const, label: 'Full Escrow', desc: 'Payment includes taxes AND insurance' },
            { value: 'taxes-only' as const, label: 'Taxes Only', desc: 'Payment includes taxes but NOT insurance' },
            { value: 'none' as const, label: 'No Escrow', desc: 'Payment is just principal & interest' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setEscrowType(opt.value)}
              className={`w-full rounded-button border p-3 text-left transition-colors ${
                escrowType === opt.value
                  ? 'border-fjord bg-fjord/5'
                  : 'border-mist bg-white hover:border-fjord'
              }`}
            >
              <p className={`text-sm font-medium ${escrowType === opt.value ? 'text-fjord' : 'text-fjord'}`}>
                {opt.label}
              </p>
              <p className="text-xs text-stone">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-0.5 block text-xs font-medium text-stone">
            Monthly Property Tax
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-xs text-stone">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={monthlyPropertyTax}
              onChange={(e) => setMonthlyPropertyTax(e.target.value)}
              className="input w-full py-1.5 pl-5 text-sm"
              placeholder="e.g. 350"
            />
          </div>
        </div>
        <div>
          <label className="mb-0.5 block text-xs font-medium text-stone">
            Monthly Insurance
            {escrowType === 'taxes-only' && <span className="text-stone"> (for reference)</span>}
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-xs text-stone">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={monthlyInsurance}
              onChange={(e) => setMonthlyInsurance(e.target.value)}
              className="input w-full py-1.5 pl-5 text-sm"
              placeholder="e.g. 120"
            />
          </div>
        </div>
        <div>
          <label className="mb-0.5 block text-xs font-medium text-stone">
            Monthly HOA <span className="text-stone">(optional)</span>
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-xs text-stone">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={monthlyHOA}
              onChange={(e) => setMonthlyHOA(e.target.value)}
              className="input w-full py-1.5 pl-5 text-sm"
              placeholder="e.g. 0"
            />
          </div>
        </div>
        <div>
          <label className="mb-0.5 block text-xs font-medium text-stone">
            Monthly PMI <span className="text-stone">(optional)</span>
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-xs text-stone">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={monthlyPMI}
              onChange={(e) => setMonthlyPMI(e.target.value)}
              className="input w-full py-1.5 pl-5 text-sm"
              placeholder="e.g. 0"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="mb-0.5 block text-xs font-medium text-stone">
          Property Value <span className="text-stone">(optional, for equity tracking)</span>
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-xs text-stone">$</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={currentValue}
            onChange={(e) => setCurrentValue(e.target.value)}
            className="input w-full py-1.5 pl-5 text-sm"
            placeholder="e.g. 350,000"
          />
        </div>
      </div>

      {/* Live PITI breakdown */}
      {pitiResult && pitiResult.totalPayment > 0 && (
        <PITIBreakdownBar piti={pitiResult} paymentMismatch={paymentMismatch} />
      )}
    </div>
  )
}

function StepAccountLinking({
  accounts,
  linkedAccountIds,
  toggleAccountLink,
}: {
  accounts: AccountOption[]
  linkedAccountIds: Set<string>
  toggleAccountLink: (id: string) => void
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-stone">
        Link accounts associated with this property (mortgage payment account, rental deposit account, etc.).
      </p>
      {accounts.length === 0 ? (
        <p className="rounded-lg border border-mist bg-white p-4 text-sm text-stone">
          No accounts available. You can link accounts later from Settings.
        </p>
      ) : (
        <div className="space-y-2">
          {accounts.map((acct) => (
            <button
              key={acct.id}
              type="button"
              onClick={() => toggleAccountLink(acct.id)}
              className={`flex w-full items-center gap-3 rounded-button border p-3 text-left transition-colors ${
                linkedAccountIds.has(acct.id)
                  ? 'border-pine bg-pine/5'
                  : 'border-mist bg-white hover:border-fjord'
              }`}
            >
              <div
                className={`flex h-5 w-5 items-center justify-center rounded border ${
                  linkedAccountIds.has(acct.id)
                    ? 'border-pine bg-pine text-snow'
                    : 'border-mist'
                }`}
              >
                {linkedAccountIds.has(acct.id) && (
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-fjord">{acct.name}</p>
                <p className="text-xs text-stone">{acct.type}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function StepSummary({
  name, propertyType, address,
  isMultiUnit, unitCount, units,
  hasMortgage, loanBalance, interestRate, loanTermMonths, monthlyPayment,
  escrowType, pitiResult,
  linkedAccountIds, accounts,
}: {
  name: string
  propertyType: PropertyTypeValue
  address: string
  isMultiUnit: boolean
  unitCount: number
  units: UnitConfig[]
  hasMortgage: boolean
  loanBalance: string
  interestRate: string
  loanTermMonths: string
  monthlyPayment: string
  escrowType: EscrowType
  pitiResult: PITIBreakdown | null
  linkedAccountIds: Set<string>
  accounts: AccountOption[]
}) {
  const linkedAccounts = accounts.filter((a) => linkedAccountIds.has(a.id))
  const taxSchedule = TAX_SCHEDULE_MAP[propertyType] ?? 'Unknown'

  return (
    <div className="space-y-4">
      {/* Basic Info */}
      <div className="rounded-lg border border-mist bg-white p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-stone">Property</p>
        <p className="text-base font-semibold text-fjord">{name || 'Unnamed'}</p>
        <div className="mt-1 flex flex-wrap gap-2">
          <span className="rounded-badge bg-fjord/10 px-2 py-0.5 text-xs font-medium text-fjord">
            {VALID_TYPES.find((t) => t.value === propertyType)?.label}
          </span>
          <span className="rounded-badge bg-frost px-2 py-0.5 text-xs font-medium text-stone">
            {taxSchedule}
          </span>
        </div>
        {address && <p className="mt-1 text-xs text-stone">{address}</p>}

        {isMultiUnit && (
          <div className="mt-2 border-t border-mist pt-2">
            <p className="text-xs font-medium text-stone">
              {unitCount} units — {Math.round(100 / unitCount)}% split each
            </p>
            <div className="mt-1 space-y-1">
              {units.slice(0, unitCount).map((unit, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-fjord">{unit.name}</span>
                  <span className="rounded-badge bg-frost px-2 py-0.5 text-stone">
                    {unit.use === 'owner-occupied' ? 'Owner-occupied (Sch. A)' :
                      unit.use === 'rented' ? 'Rented (Sch. E)' : 'Vacant'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mortgage Summary */}
      {hasMortgage && (
        <div className="rounded-lg border border-mist bg-white p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-stone">Mortgage</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-stone">Balance:</span>{' '}
              <span className="font-mono font-medium text-fjord">{formatCurrency(parseFloat(loanBalance) || 0)}</span>
            </div>
            <div>
              <span className="text-stone">Rate:</span>{' '}
              <span className="font-mono font-medium text-fjord">{interestRate}%</span>
            </div>
            <div>
              <span className="text-stone">Term:</span>{' '}
              <span className="font-mono font-medium text-fjord">{loanTermMonths} months</span>
            </div>
            <div>
              <span className="text-stone">Payment:</span>{' '}
              <span className="font-mono font-medium text-fjord">{formatCurrency(parseFloat(monthlyPayment) || 0)}/mo</span>
            </div>
          </div>

          {/* PITI Stacked Bar */}
          {pitiResult && pitiResult.totalPayment > 0 && (
            <div className="mt-3 border-t border-mist pt-3">
              <PITIBreakdownBar piti={pitiResult} paymentMismatch={null} />
            </div>
          )}
        </div>
      )}

      {!hasMortgage && (
        <div className="rounded-lg border border-mist bg-white p-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-stone">Mortgage</p>
          <p className="text-sm text-stone">No mortgage</p>
        </div>
      )}

      {/* Linked Accounts */}
      {linkedAccounts.length > 0 && (
        <div className="rounded-lg border border-mist bg-white p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-stone">Linked Accounts</p>
          <div className="space-y-1">
            {linkedAccounts.map((a) => (
              <p key={a.id} className="text-sm text-fjord">{a.name}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Shared Components ───────────────────────────────────────────────────────

function PITIBreakdownBar({
  piti,
  paymentMismatch,
}: {
  piti: PITIBreakdown
  paymentMismatch: number | null
}) {
  const total = piti.totalPayment
  if (total <= 0) return null

  const items = [
    { label: 'Principal', amount: piti.principal, color: 'bg-pine' },
    { label: 'Interest', amount: piti.interest, color: 'bg-ember' },
    ...(piti.propertyTax > 0 ? [{ label: 'Tax', amount: piti.propertyTax, color: 'bg-birch' }] : []),
    ...(piti.insurance > 0 ? [{ label: 'Insurance', amount: piti.insurance, color: 'bg-lichen' }] : []),
    ...(piti.hoa > 0 ? [{ label: 'HOA', amount: piti.hoa, color: 'bg-mist' }] : []),
    ...(piti.pmi > 0 ? [{ label: 'PMI', amount: piti.pmi, color: 'bg-stone/50' }] : []),
  ]

  return (
    <div className="rounded-lg border border-pine/20 bg-pine/5 p-3">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-stone">
        PITI Breakdown
      </p>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
            <span className="text-stone">{item.label}:</span>
            <span className="font-semibold text-fjord">{formatCurrency(item.amount)}</span>
          </div>
        ))}
      </div>

      {/* Stacked bar */}
      <div className="mt-2 flex h-2 overflow-hidden rounded-bar">
        {items.map((item) => (
          <div
            key={item.label}
            className={item.color}
            style={{ width: `${(item.amount / total) * 100}%` }}
          />
        ))}
      </div>

      {paymentMismatch != null && (
        <p className="mt-2 text-[10px] text-ember">
          Escrow components + P&I differ from total payment by {formatCurrency(paymentMismatch)}.
          Check your escrow amounts.
        </p>
      )}
    </div>
  )
}

function SuccessScreen({
  isMultiUnit,
  name,
  onClose,
}: {
  isMultiUnit: boolean
  name: string
  onClose: () => void
}) {
  return (
    <div className="py-6 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-pine/10">
        <svg className="h-6 w-6 text-pine" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h3 className="mb-1 font-display text-lg font-semibold text-fjord">
        Property {isMultiUnit ? 'Group ' : ''}Created
      </h3>
      <p className="mb-4 text-sm text-stone">
        {name} has been set up successfully.
        {isMultiUnit && ' Individual unit properties have been created with split allocations.'}
      </p>
      <button onClick={onClose} className="btn-primary px-6 py-2 text-sm">
        Done
      </button>
    </div>
  )
}
