/**
 * Tax engine — pure calculation logic, no database or framework imports.
 *
 * Database lookups (finding which rules exist, loading thresholds) stay
 * in API routes. This engine receives rule parameters and computes results.
 */

export interface TaxRuleInput {
  ruleCode: string
  filingStatus: string
  income: number
  propertyType?: 'personal' | 'rental'
}

export interface DeductionResult {
  eligible: boolean
  amount: number
  form: string
  formLine?: string
  limitApplied?: string // e.g., "AGI floor 7.5%", "Phase-out at $150k"
  notes?: string
}

export interface RentalAllocation {
  category: string
  totalAmount: number
  deductibleAmount: number
  allocationMethod: string
  allocationPct: number
  form: string
  scheduleECategory?: string
}

/** Look up whether a tax rule applies given filing status and income */
export function isRuleApplicable(
  rule: TaxRuleInput,
  appliesTo: string[],
  filingStatuses: string[],
): boolean {
  // Check property type applicability
  if (appliesTo.length > 0) {
    const ruleProperty = rule.propertyType ?? 'personal'
    if (!appliesTo.includes(ruleProperty) && !appliesTo.includes('all')) {
      return false
    }
  }

  // Check filing status
  if (filingStatuses.length > 0 && !filingStatuses.includes(rule.filingStatus)) {
    return false
  }

  return true
}

/** Calculate deduction amount with phase-outs and limits */
export function calculateDeduction(
  grossAmount: number,
  annualLimit: number | null,
  percentageLimit: number | null,
  income: number,
  phaseOutStart: number | null,
  phaseOutEnd: number | null,
): DeductionResult {
  let amount = grossAmount
  let limitApplied: string | undefined

  // Apply percentage limit (e.g., AGI floor for medical expenses)
  if (percentageLimit !== null) {
    const floor = income * percentageLimit
    amount = Math.max(0, amount - floor)
    if (amount < grossAmount) {
      limitApplied = `AGI floor ${(percentageLimit * 100).toFixed(1)}%`
    }
  }

  // Apply annual cap
  if (annualLimit !== null && amount > annualLimit) {
    amount = annualLimit
    limitApplied = `Annual limit $${annualLimit.toLocaleString()}`
  }

  // Apply phase-out
  if (phaseOutStart !== null && phaseOutEnd !== null && income > phaseOutStart) {
    if (income >= phaseOutEnd) {
      return {
        eligible: false,
        amount: 0,
        form: '',
        limitApplied: `Phase-out complete at $${phaseOutEnd.toLocaleString()}`,
      }
    }
    const phaseOutRange = phaseOutEnd - phaseOutStart
    const incomeOver = income - phaseOutStart
    const reductionPct = incomeOver / phaseOutRange
    amount = amount * (1 - reductionPct)
    limitApplied = `Phase-out at $${phaseOutStart.toLocaleString()}`
  }

  return {
    eligible: amount > 0,
    amount: Math.round(amount * 100) / 100,
    form: '',
    limitApplied,
  }
}

/** Allocate a rental expense to Schedule E categories */
export function allocateRentalExpense(
  amount: number,
  spendingCategory: string,
  allocationMethod: string,
  allocationPct: number,
): RentalAllocation {
  const deductibleAmount = Math.round(amount * allocationPct * 100) / 100

  return {
    category: spendingCategory,
    totalAmount: amount,
    deductibleAmount,
    allocationMethod,
    allocationPct,
    form: 'Schedule E',
  }
}

/** Calculate Section 199A QBI deduction (simplified) */
export function qbiDeduction(
  qualifiedIncome: number,
  taxableIncome: number,
  filingStatus: string,
): number {
  // Standard QBI deduction is 20% of qualified business income
  const baseDeduction = qualifiedIncome * 0.2

  // Phase-out thresholds for 2024/2025
  const threshold = filingStatus === 'married_filing_jointly' ? 383900 : 191950
  const phaseOutEnd = filingStatus === 'married_filing_jointly' ? 483900 : 241950

  if (taxableIncome <= threshold) {
    return Math.round(baseDeduction * 100) / 100
  }

  if (taxableIncome >= phaseOutEnd) {
    // Above phase-out: subject to wage/property limits (simplified to 0 here)
    return 0
  }

  // Partial phase-out
  const phaseOutRange = phaseOutEnd - threshold
  const incomeOver = taxableIncome - threshold
  const reductionPct = incomeOver / phaseOutRange
  const reduced = baseDeduction * (1 - reductionPct)

  return Math.round(reduced * 100) / 100
}

/**
 * Calculate tax liability for a set of income brackets.
 * Brackets is an array of { min, max, rate } sorted ascending by min.
 */
export function calculateBracketTax(
  taxableIncome: number,
  brackets: Array<{ min: number; max: number | null; rate: number }>,
): number {
  let tax = 0

  for (const bracket of brackets) {
    if (taxableIncome <= bracket.min) break

    const upper = bracket.max !== null ? Math.min(taxableIncome, bracket.max) : taxableIncome
    const taxableInBracket = upper - bracket.min
    tax += taxableInBracket * bracket.rate
  }

  return Math.round(tax * 100) / 100
}

/**
 * Calculate SALT deduction (state and local taxes), subject to $10K cap.
 */
export function saltDeduction(
  stateIncomeTax: number,
  propertyTax: number,
  filingStatus: string,
): DeductionResult {
  const total = stateIncomeTax + propertyTax
  const cap = filingStatus === 'married_filing_separately' ? 5000 : 10000
  const amount = Math.min(total, cap)

  return {
    eligible: amount > 0,
    amount: Math.round(amount * 100) / 100,
    form: 'Schedule A',
    formLine: 'Line 5d',
    limitApplied: total > cap ? `SALT cap $${cap.toLocaleString()}` : undefined,
  }
}

/**
 * Calculate mortgage interest deduction.
 * Post-2017 TCJA: deductible on first $750K of acquisition debt ($375K MFS).
 */
export function mortgageInterestDeduction(
  interestPaid: number,
  loanBalance: number,
  filingStatus: string,
): DeductionResult {
  const debtLimit = filingStatus === 'married_filing_separately' ? 375000 : 750000

  let amount = interestPaid
  let limitApplied: string | undefined

  if (loanBalance > debtLimit) {
    const ratio = debtLimit / loanBalance
    amount = interestPaid * ratio
    limitApplied = `Debt limit $${debtLimit.toLocaleString()}`
  }

  return {
    eligible: amount > 0,
    amount: Math.round(amount * 100) / 100,
    form: 'Schedule A',
    formLine: 'Line 8a',
    limitApplied,
  }
}

/**
 * Calculate student loan interest deduction (above-the-line).
 * $2,500 annual cap with income phase-out.
 */
export function studentLoanInterestDeduction(
  interestPaid: number,
  magi: number,
  filingStatus: string,
): DeductionResult {
  if (filingStatus === 'married_filing_separately') {
    return { eligible: false, amount: 0, form: 'Form 1040', notes: 'Not available for MFS' }
  }

  const cap = 2500
  const phaseOutStart = filingStatus === 'married_filing_jointly' ? 155000 : 75000
  const phaseOutEnd = filingStatus === 'married_filing_jointly' ? 185000 : 90000

  let amount = Math.min(interestPaid, cap)

  if (magi > phaseOutEnd) {
    return {
      eligible: false,
      amount: 0,
      form: 'Form 1040',
      formLine: 'Line 21',
      limitApplied: `Phase-out complete at $${phaseOutEnd.toLocaleString()}`,
    }
  }

  if (magi > phaseOutStart) {
    const reductionPct = (magi - phaseOutStart) / (phaseOutEnd - phaseOutStart)
    amount = amount * (1 - reductionPct)
  }

  return {
    eligible: amount > 0,
    amount: Math.round(amount * 100) / 100,
    form: 'Form 1040',
    formLine: 'Line 21',
    limitApplied: interestPaid > cap ? `Annual cap $${cap.toLocaleString()}` : undefined,
  }
}
