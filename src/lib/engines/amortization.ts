/**
 * Amortization engine — pure math, no database or framework imports.
 *
 * Standard fixed-rate amortization formulas for mortgages, auto loans,
 * student loans, and other installment debt.
 */

/** Core amortization inputs */
export interface LoanParams {
  principal: number
  annualRate: number // e.g., 0.04875 for 4.875%
  termMonths: number
  escrowMonthly?: number // taxes + insurance escrowed into payment
}

export interface AmortizationRow {
  month: number
  payment: number // total monthly payment (P&I only, before escrow)
  principal: number // principal portion
  interest: number // interest portion
  remainingBalance: number
}

export interface PayoffSummary {
  monthlyPayment: number // P&I payment
  totalPayment: number // total P&I (with escrow if provided)
  totalInterest: number
  totalPaid: number
  schedule: AmortizationRow[]
}

/** Calculate fixed monthly P&I payment */
export function monthlyPayment(principal: number, annualRate: number, termMonths: number): number {
  if (principal <= 0 || termMonths <= 0) return 0
  if (annualRate === 0) return principal / termMonths

  const r = annualRate / 12
  return (principal * r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1)
}

/** Generate full amortization schedule */
export function amortizationSchedule(params: LoanParams): PayoffSummary {
  const { principal, annualRate, termMonths, escrowMonthly } = params
  const pmt = monthlyPayment(principal, annualRate, termMonths)
  const r = annualRate / 12
  const schedule: AmortizationRow[] = []
  let balance = principal
  let totalInterest = 0

  for (let month = 1; month <= termMonths && balance > 0.005; month++) {
    const interest = balance * r
    const principalPortion = Math.min(pmt - interest, balance)
    balance = Math.max(0, balance - principalPortion)
    totalInterest += interest

    schedule.push({
      month,
      payment: Math.round((interest + principalPortion) * 100) / 100,
      principal: Math.round(principalPortion * 100) / 100,
      interest: Math.round(interest * 100) / 100,
      remainingBalance: Math.round(balance * 100) / 100,
    })
  }

  const totalPIPayments = schedule.reduce((sum, row) => sum + row.payment, 0)

  return {
    monthlyPayment: Math.round(pmt * 100) / 100,
    totalPayment: Math.round((pmt + (escrowMonthly ?? 0)) * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalPaid: Math.round((totalPIPayments + (escrowMonthly ?? 0) * schedule.length) * 100) / 100,
    schedule,
  }
}

/** Calculate payoff with extra monthly payment */
export function payoffWithExtra(params: LoanParams, extraMonthly: number): PayoffSummary {
  const { principal, annualRate, termMonths, escrowMonthly } = params
  const basePmt = monthlyPayment(principal, annualRate, termMonths)
  const totalPmt = basePmt + extraMonthly
  const r = annualRate / 12
  const schedule: AmortizationRow[] = []
  let balance = principal
  let totalInterest = 0

  for (let month = 1; balance > 0.005; month++) {
    const interest = balance * r
    const principalPortion = Math.min(totalPmt - interest, balance)
    balance = Math.max(0, balance - principalPortion)
    totalInterest += interest

    schedule.push({
      month,
      payment: Math.round((interest + principalPortion) * 100) / 100,
      principal: Math.round(principalPortion * 100) / 100,
      interest: Math.round(interest * 100) / 100,
      remainingBalance: Math.round(balance * 100) / 100,
    })
  }

  const totalPIPayments = schedule.reduce((sum, row) => sum + row.payment, 0)

  return {
    monthlyPayment: Math.round(totalPmt * 100) / 100,
    totalPayment: Math.round((totalPmt + (escrowMonthly ?? 0)) * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalPaid: Math.round((totalPIPayments + (escrowMonthly ?? 0) * schedule.length) * 100) / 100,
    schedule,
  }
}

/** Calculate months saved and interest saved from extra payments */
export function extraPaymentImpact(
  params: LoanParams,
  extraMonthly: number,
): {
  monthsSaved: number
  interestSaved: number
  newPayoffDate: Date
} {
  const base = amortizationSchedule(params)
  const extra = payoffWithExtra(params, extraMonthly)

  const now = new Date()
  const newPayoffDate = new Date(now.getFullYear(), now.getMonth() + extra.schedule.length, 1)

  return {
    monthsSaved: base.schedule.length - extra.schedule.length,
    interestSaved: Math.round((base.totalInterest - extra.totalInterest) * 100) / 100,
    newPayoffDate,
  }
}

/** Split a total mortgage payment into P&I and escrow components */
export function splitPayment(
  totalPayment: number,
  escrowAmount: number,
): {
  piPayment: number
  escrow: number
} {
  return {
    piPayment: totalPayment - escrowAmount,
    escrow: escrowAmount,
  }
}

/**
 * Compute P&I breakdown from current balance and payment info.
 * This is the inline calculation currently used by debt routes and components.
 */
export function piBreakdown(
  currentBalance: number,
  annualRate: number,
  minimumPayment: number,
  escrowAmount?: number | null,
): {
  piPayment: number
  monthlyInterest: number
  monthlyPrincipal: number
  monthsRemaining: number | null
} {
  const piPayment = minimumPayment - (escrowAmount ?? 0)
  const monthlyRate = annualRate / 12
  const monthlyInterest = currentBalance * monthlyRate
  const monthlyPrincipal = Math.max(0, piPayment - monthlyInterest)

  // Use amortization formula for months remaining (not linear division).
  // n = -ln(1 - balance * r / P) / ln(1 + r), where P = piPayment, r = monthly rate
  let monthsRemaining: number | null = null
  if (monthlyPrincipal > 0 && piPayment > monthlyInterest && annualRate > 0) {
    const fraction = 1 - (currentBalance * monthlyRate) / piPayment
    if (fraction > 0) {
      monthsRemaining = Math.ceil(-Math.log(fraction) / Math.log(1 + monthlyRate))
    }
  } else if (monthlyPrincipal > 0 && annualRate === 0) {
    monthsRemaining = Math.ceil(currentBalance / piPayment)
  }

  return {
    piPayment,
    monthlyInterest: Math.round(monthlyInterest * 100) / 100,
    monthlyPrincipal: Math.round(monthlyPrincipal * 100) / 100,
    monthsRemaining,
  }
}

/** PITI breakdown result */
export interface PITIBreakdown {
  principal: number
  interest: number
  propertyTax: number
  insurance: number
  hoa: number
  pmi: number
  escrowTotal: number
  piPayment: number
  totalPayment: number
}

/**
 * Decompose a mortgage payment into PITI components.
 * Unlike piBreakdown(), this separates escrow into tax, insurance, HOA, and PMI.
 */
export function pitiBreakdown(
  currentBalance: number,
  annualRate: number,
  totalMonthlyPayment: number,
  monthlyPropertyTax: number,
  monthlyInsurance: number,
  monthlyHOA: number,
  monthlyPMI: number,
): PITIBreakdown {
  const escrowTotal = monthlyPropertyTax + monthlyInsurance + monthlyHOA + monthlyPMI
  const piPayment = totalMonthlyPayment - escrowTotal
  const monthlyRate = annualRate / 12
  const interest = Math.round(currentBalance * monthlyRate * 100) / 100
  const principal = Math.round(Math.max(0, piPayment - interest) * 100) / 100

  return {
    principal,
    interest,
    propertyTax: monthlyPropertyTax,
    insurance: monthlyInsurance,
    hoa: monthlyHOA,
    pmi: monthlyPMI,
    escrowTotal: Math.round(escrowTotal * 100) / 100,
    piPayment: Math.round(piPayment * 100) / 100,
    totalPayment: totalMonthlyPayment,
  }
}

/**
 * Effective interest rate — the true cost of a mortgage including escrow.
 * (total monthly cost / loan balance) × 12
 */
export function effectiveRate(
  currentBalance: number,
  totalMonthlyPayment: number,
): number {
  if (currentBalance <= 0 || totalMonthlyPayment <= 0) return 0
  return Math.round(((totalMonthlyPayment * 12) / currentBalance) * 10000) / 10000
}
