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
  propertyType?: 'personal' | 'rental' | 'business'
}

export interface DeductionResult {
  eligible: boolean
  amount: number
  form: string
  formLine?: string
  limitApplied?: string // e.g., "AGI floor 7.5%", "Phase-out at $150k"
  notes?: string
}

export interface DepreciationInput {
  purchasePrice: number
  purchaseDate: Date
  buildingValuePct: number // 0-100, default 80
  priorDepreciation: number // Already-claimed depreciation (for in-progress properties)
  asOfDate: Date // Calculate depreciation through this date
}

export interface DepreciationResult {
  buildingValue: number // purchasePrice × buildingValuePct / 100
  landValue: number // purchasePrice - buildingValue
  annualDepreciation: number // buildingValue / 27.5
  monthlyDepreciation: number // annualDepreciation / 12
  totalDepreciation: number // From purchase date through asOfDate (capped at buildingValue)
  remainingBasis: number // buildingValue - totalDepreciation
  yearsElapsed: number
  yearsRemaining: number // 27.5 - yearsElapsed (min 0)
  priorDepreciation: number // What user already claimed
  currentYearDepreciation: number // This tax year only
}

export interface TaxSummary {
  scheduleA: {
    mortgageInterest: number
    propertyTax: number
    otherDeductions: { category: string; amount: number }[]
    total: number
  }
  scheduleE: {
    properties: Array<{
      propertyName: string
      propertyId: string
      income: number
      expenses: { category: string; amount: number }[]
      depreciation: number
      netIncome: number
    }>
    totalNetIncome: number
  }
  scheduleC: {
    businesses: Array<{
      businessName: string
      propertyId: string
      income: number
      expenses: { category: string; amount: number }[]
      netIncome: number
    }>
    totalNetIncome: number
  }
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

  // Phase-out thresholds for 2025 (extended by OBBBA)
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
 * Calculate SALT deduction (state and local taxes).
 * OBBBA (July 2025) raised cap from $10K to $40K, with phase-out above $500K MAGI.
 * Cap rises 1%/year: $40K (2025), $40,400 (2026).
 */
export function saltDeduction(
  stateIncomeTax: number,
  propertyTax: number,
  filingStatus: string,
  magi?: number,
  taxYear: number = 2025,
): DeductionResult {
  const total = stateIncomeTax + propertyTax

  // OBBBA SALT caps (1% annual increase)
  const baseCap = taxYear >= 2026 ? 40400 : 40000
  const cap = filingStatus === 'married_filing_separately' ? baseCap / 2 : baseCap
  let amount = Math.min(total, cap)

  // Phase-out: $500K-$600K MAGI ($250K-$300K MFS)
  const phaseOutStart = filingStatus === 'married_filing_separately' ? 250000 : 500000
  const phaseOutEnd = filingStatus === 'married_filing_separately' ? 300000 : 600000

  let limitApplied: string | undefined
  if (total > cap) {
    limitApplied = `SALT cap $${cap.toLocaleString()}`
  }

  if (magi !== undefined && magi > phaseOutStart) {
    if (magi >= phaseOutEnd) {
      return {
        eligible: false,
        amount: 0,
        form: 'Schedule A',
        formLine: 'Line 5d',
        limitApplied: `SALT phase-out complete at $${phaseOutEnd.toLocaleString()} MAGI`,
      }
    }
    const reductionPct = (magi - phaseOutStart) / (phaseOutEnd - phaseOutStart)
    amount = amount * (1 - reductionPct)
    limitApplied = `SALT phase-out at $${phaseOutStart.toLocaleString()} MAGI`
  }

  return {
    eligible: amount > 0,
    amount: Math.round(amount * 100) / 100,
    form: 'Schedule A',
    formLine: 'Line 5d',
    limitApplied,
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

/**
 * Calculate straight-line depreciation for a residential rental property.
 * IRS rules: 27.5-year recovery period, straight-line method.
 *
 * Building vs. land: Only the building portion depreciates.
 * User provides buildingValuePct (default 80%). Common sources:
 * - County property tax assessment (building value / total assessed value)
 * - Appraisal at time of purchase
 * - Default 80/20 is IRS-accepted reasonable estimate
 *
 * First-year depreciation uses the mid-month convention:
 * the property is treated as placed in service at the midpoint of the month.
 *
 * For properties already being depreciated:
 * - priorDepreciation = total already claimed on previous tax returns
 * - currentYearDepreciation starts from where prior left off
 * - totalDepreciation = priorDepreciation + new depreciation
 * - Capped at buildingValue (can't depreciate more than the building is worth)
 */
export function calculateDepreciation(input: DepreciationInput): DepreciationResult {
  const { purchasePrice, purchaseDate, buildingValuePct, priorDepreciation, asOfDate } = input

  const buildingValue = Math.round((purchasePrice * buildingValuePct) / 100 * 100) / 100
  const landValue = Math.round((purchasePrice - buildingValue) * 100) / 100

  // Edge: 0% building → no depreciation
  if (buildingValue <= 0) {
    return {
      buildingValue: 0,
      landValue: purchasePrice,
      annualDepreciation: 0,
      monthlyDepreciation: 0,
      totalDepreciation: priorDepreciation,
      remainingBasis: 0,
      yearsElapsed: 0,
      yearsRemaining: 0,
      priorDepreciation,
      currentYearDepreciation: 0,
    }
  }

  const annualDepreciation = Math.round((buildingValue / 27.5) * 100) / 100
  const monthlyDepreciation = Math.round((annualDepreciation / 12) * 100) / 100

  // Calculate total months of depreciation from purchase to asOfDate
  // Mid-month convention: placed in service at midpoint of the month
  const purchaseYear = purchaseDate.getFullYear()
  const purchaseMonth = purchaseDate.getMonth() // 0-indexed
  const asOfYear = asOfDate.getFullYear()
  const asOfMonth = asOfDate.getMonth()

  // First month gets half-month depreciation (mid-month convention)
  // Total full months from start of month after purchase through end of asOfDate month
  const totalCalendarMonths =
    (asOfYear - purchaseYear) * 12 + (asOfMonth - purchaseMonth)

  // Mid-month convention: first month = 0.5 months, subsequent months = 1 each
  // Last month of the current year also gets full month (convention applies only to first/last year)
  let depreciableMonths: number
  if (totalCalendarMonths <= 0) {
    // Same month as purchase
    depreciableMonths = 0.5
  } else {
    // First month is 0.5, rest are full months
    depreciableMonths = 0.5 + totalCalendarMonths
  }

  // Cap at 27.5 years = 330 months
  const maxMonths = 27.5 * 12
  const fullyDepreciated = depreciableMonths >= maxMonths
  depreciableMonths = Math.min(depreciableMonths, maxMonths)

  // Total depreciation = monthly rate × months, capped at building value
  // When fully depreciated, use buildingValue directly to avoid floating point drift
  const totalDepreciation = fullyDepreciated
    ? buildingValue
    : Math.min(Math.round((buildingValue / 27.5 / 12) * depreciableMonths * 100) / 100, buildingValue)

  const yearsElapsed = Math.round((depreciableMonths / 12) * 100) / 100
  const yearsRemaining = Math.max(0, Math.round((27.5 - yearsElapsed) * 100) / 100)
  const remainingBasis = Math.max(0, Math.round((buildingValue - totalDepreciation) * 100) / 100)

  // Current year depreciation: from Jan 1 of asOfDate year (or purchase date if same year)
  const currentYearStart = new Date(asOfYear, 0, 1)
  let currentYearMonths: number

  if (purchaseYear === asOfYear) {
    // Purchased this year: mid-month convention on first month through asOfMonth
    currentYearMonths = depreciableMonths // already calculated above
  } else {
    // Full months from Jan through asOfMonth (inclusive)
    currentYearMonths = asOfMonth + 1
  }

  // Ensure current year doesn't exceed remaining depreciable basis after prior
  const maxCurrentYear = Math.max(0, buildingValue - priorDepreciation)
  const rawCurrentYear = (annualDepreciation / 12) * currentYearMonths
  const currentYearDepreciation = Math.min(
    Math.round(rawCurrentYear * 100) / 100,
    annualDepreciation, // can't exceed one year's worth
    maxCurrentYear,
  )

  return {
    buildingValue,
    landValue,
    annualDepreciation,
    monthlyDepreciation,
    totalDepreciation,
    remainingBasis,
    yearsElapsed,
    yearsRemaining,
    priorDepreciation,
    currentYearDepreciation,
  }
}

/**
 * Generate a tax summary for a date range from transaction splits and direct attributions.
 * Pure logic — receives pre-fetched data, no database calls.
 *
 * Aggregates amounts by schedule (A, E, C) and property.
 * Adds depreciation from property records for rental properties.
 */
export function generateTaxSummary(
  splits: Array<{
    propertyId: string
    amount: number
    transaction: {
      classification: string
      category?: { group: string; name: string; scheduleECategory?: string | null } | null
    }
  }>,
  directAttributions: Array<{
    propertyId: string
    amount: number
    classification: string
    category?: { group: string; name: string; scheduleECategory?: string | null } | null
  }>,
  properties: Array<{
    id: string
    name: string
    type: string // 'PERSONAL' | 'RENTAL' | 'BUSINESS'
    taxSchedule?: string | null
    purchasePrice?: number | null
    purchaseDate?: Date | null
    buildingValuePct?: number | null
    priorDepreciation?: number | null
    // Financial details for PITI decomposition
    loanBalance?: number | null
    interestRate?: number | null
    monthlyPayment?: number | null
    monthlyPropertyTax?: number | null
    monthlyInsurance?: number | null
    monthlyHOA?: number | null
    monthlyPMI?: number | null
  }>,
  dateRange: { start: Date; end: Date },
): TaxSummary {
  const propertyMap = new Map(properties.map((p) => [p.id, p]))

  // Merge splits and direct attributions into a unified list
  const allItems: Array<{
    propertyId: string
    amount: number
    classification: string
    categoryGroup: string
    categoryName: string
    scheduleECategory: string | null
  }> = []

  for (const s of splits) {
    allItems.push({
      propertyId: s.propertyId,
      amount: s.amount,
      classification: s.transaction.classification,
      categoryGroup: s.transaction.category?.group ?? '',
      categoryName: s.transaction.category?.name ?? 'Uncategorized',
      scheduleECategory: s.transaction.category?.scheduleECategory ?? null,
    })
  }

  for (const d of directAttributions) {
    allItems.push({
      propertyId: d.propertyId,
      amount: d.amount,
      classification: d.classification,
      categoryGroup: d.category?.group ?? '',
      categoryName: d.category?.name ?? 'Uncategorized',
      scheduleECategory: d.category?.scheduleECategory ?? null,
    })
  }

  // ─── Schedule A (personal deductions) ──────────────────────────────
  let mortgageInterest = 0
  let propertyTax = 0
  const otherADeductions = new Map<string, number>()

  // ─── Schedule E (rental properties) ────────────────────────────────
  const schedEProperties = new Map<
    string,
    { income: number; expenses: Map<string, number> }
  >()

  // ─── Schedule C (businesses) ───────────────────────────────────────
  const schedCBusinesses = new Map<
    string,
    { income: number; expenses: Map<string, number> }
  >()

  // Helper: check if a category name looks like a mortgage payment
  function isMortgageCategory(name: string): boolean {
    const lower = name.toLowerCase()
    return lower.includes('mortgage') || lower.includes('home loan')
  }

  // Helper: check if a property has PITI financial details
  function hasPitiDetails(prop: typeof properties[number]): boolean {
    return prop.loanBalance != null && prop.loanBalance > 0 &&
      prop.interestRate != null && prop.monthlyPayment != null && prop.monthlyPayment > 0
  }

  // Helper: compute PITI ratios for a property
  function pitiRatios(prop: typeof properties[number]): {
    interestPct: number
    taxPct: number
    insurancePct: number
    principalPct: number
  } {
    const balance = prop.loanBalance ?? 0
    const rate = prop.interestRate ?? 0
    const total = prop.monthlyPayment ?? 0
    const tax = prop.monthlyPropertyTax ?? 0
    const ins = prop.monthlyInsurance ?? 0
    const hoa = prop.monthlyHOA ?? 0
    const pmi = prop.monthlyPMI ?? 0
    const escrow = tax + ins + hoa + pmi
    const pi = total - escrow
    const interest = balance * (rate / 12)
    const principal = Math.max(0, pi - interest)

    if (total <= 0) return { interestPct: 0, taxPct: 0, insurancePct: 0, principalPct: 0 }

    return {
      interestPct: interest / total,
      taxPct: tax / total,
      insurancePct: (ins + hoa + pmi) / total,
      principalPct: principal / total,
    }
  }

  for (const item of allItems) {
    const prop = propertyMap.get(item.propertyId)
    if (!prop) continue

    const schedule = prop.taxSchedule ?? (
      prop.type === 'RENTAL' ? 'SCHEDULE_E' :
        prop.type === 'BUSINESS' ? 'SCHEDULE_C' :
          'SCHEDULE_A'
    )

    if (schedule === 'SCHEDULE_A') {
      const absAmount = Math.abs(item.amount)
      const lowerName = item.categoryName.toLowerCase()

      // PITI decomposition for Schedule A: if mortgage category and property has financial details
      if (isMortgageCategory(item.categoryName) && item.classification === 'expense' && hasPitiDetails(prop)) {
        const ratios = pitiRatios(prop)
        mortgageInterest += Math.round(absAmount * ratios.interestPct * 100) / 100
        propertyTax += Math.round(absAmount * ratios.taxPct * 100) / 100
        // Principal is not deductible — intentionally dropped
        // Insurance on personal property is not deductible — intentionally dropped
      } else if (lowerName.includes('mortgage') && lowerName.includes('interest')) {
        mortgageInterest += absAmount
      } else if (lowerName.includes('property tax') || lowerName.includes('real estate tax')) {
        propertyTax += absAmount
      } else if (item.classification === 'expense') {
        const key = item.categoryName
        otherADeductions.set(key, (otherADeductions.get(key) ?? 0) + absAmount)
      }
    } else if (schedule === 'SCHEDULE_E') {
      if (!schedEProperties.has(item.propertyId)) {
        schedEProperties.set(item.propertyId, { income: 0, expenses: new Map() })
      }
      const entry = schedEProperties.get(item.propertyId)!
      if (item.classification === 'income' || item.amount > 0) {
        entry.income += Math.abs(item.amount)
      } else if (isMortgageCategory(item.categoryName) && hasPitiDetails(prop)) {
        // PITI decomposition for Schedule E
        const absAmount = Math.abs(item.amount)
        const ratios = pitiRatios(prop)
        const interestAmt = Math.round(absAmount * ratios.interestPct * 100) / 100
        const taxAmt = Math.round(absAmount * ratios.taxPct * 100) / 100
        const insAmt = Math.round(absAmount * ratios.insurancePct * 100) / 100
        // Principal is not deductible — excluded
        if (interestAmt > 0) entry.expenses.set('Mortgage Interest', (entry.expenses.get('Mortgage Interest') ?? 0) + interestAmt)
        if (taxAmt > 0) entry.expenses.set('Property Tax', (entry.expenses.get('Property Tax') ?? 0) + taxAmt)
        if (insAmt > 0) entry.expenses.set('Insurance', (entry.expenses.get('Insurance') ?? 0) + insAmt)
      } else {
        const key = item.scheduleECategory ?? item.categoryName
        entry.expenses.set(key, (entry.expenses.get(key) ?? 0) + Math.abs(item.amount))
      }
    } else if (schedule === 'SCHEDULE_C') {
      if (!schedCBusinesses.has(item.propertyId)) {
        schedCBusinesses.set(item.propertyId, { income: 0, expenses: new Map() })
      }
      const entry = schedCBusinesses.get(item.propertyId)!
      if (item.classification === 'income' || item.amount > 0) {
        entry.income += Math.abs(item.amount)
      } else if (isMortgageCategory(item.categoryName) && hasPitiDetails(prop)) {
        // PITI decomposition for Schedule C
        const absAmount = Math.abs(item.amount)
        const ratios = pitiRatios(prop)
        const interestAmt = Math.round(absAmount * ratios.interestPct * 100) / 100
        const taxAmt = Math.round(absAmount * ratios.taxPct * 100) / 100
        const insAmt = Math.round(absAmount * ratios.insurancePct * 100) / 100
        if (interestAmt > 0) entry.expenses.set('Mortgage Interest', (entry.expenses.get('Mortgage Interest') ?? 0) + interestAmt)
        if (taxAmt > 0) entry.expenses.set('Property Tax', (entry.expenses.get('Property Tax') ?? 0) + taxAmt)
        if (insAmt > 0) entry.expenses.set('Insurance', (entry.expenses.get('Insurance') ?? 0) + insAmt)
      } else {
        const key = item.categoryName
        entry.expenses.set(key, (entry.expenses.get(key) ?? 0) + Math.abs(item.amount))
      }
    }
  }

  // Build Schedule E with depreciation
  const scheduleEResults: TaxSummary['scheduleE']['properties'] = []
  let totalENet = 0

  for (const [propId, data] of schedEProperties) {
    const prop = propertyMap.get(propId)!
    const expenses = Array.from(data.expenses, ([category, amount]) => ({
      category,
      amount: Math.round(amount * 100) / 100,
    }))
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)

    // Calculate depreciation if property has the data
    let depreciation = 0
    if (prop.purchasePrice && prop.purchaseDate) {
      const depResult = calculateDepreciation({
        purchasePrice: Number(prop.purchasePrice),
        purchaseDate: prop.purchaseDate instanceof Date ? prop.purchaseDate : new Date(String(prop.purchaseDate)),
        buildingValuePct: Number(prop.buildingValuePct ?? 80),
        priorDepreciation: Number(prop.priorDepreciation ?? 0),
        asOfDate: dateRange.end,
      })
      depreciation = depResult.currentYearDepreciation
    }

    const netIncome = Math.round((data.income - totalExpenses - depreciation) * 100) / 100
    totalENet += netIncome

    scheduleEResults.push({
      propertyName: prop.name,
      propertyId: propId,
      income: Math.round(data.income * 100) / 100,
      expenses,
      depreciation: Math.round(depreciation * 100) / 100,
      netIncome,
    })
  }

  // Build Schedule C
  const scheduleCResults: TaxSummary['scheduleC']['businesses'] = []
  let totalCNet = 0

  for (const [propId, data] of schedCBusinesses) {
    const prop = propertyMap.get(propId)!
    const expenses = Array.from(data.expenses, ([category, amount]) => ({
      category,
      amount: Math.round(amount * 100) / 100,
    }))
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
    const netIncome = Math.round((data.income - totalExpenses) * 100) / 100
    totalCNet += netIncome

    scheduleCResults.push({
      businessName: prop.name,
      propertyId: propId,
      income: Math.round(data.income * 100) / 100,
      expenses,
      netIncome,
    })
  }

  // Build Schedule A
  const otherDeductions = Array.from(otherADeductions, ([category, amount]) => ({
    category,
    amount: Math.round(amount * 100) / 100,
  }))
  const schedATotal = Math.round(
    (mortgageInterest + propertyTax + otherDeductions.reduce((s, d) => s + d.amount, 0)) * 100,
  ) / 100

  return {
    scheduleA: {
      mortgageInterest: Math.round(mortgageInterest * 100) / 100,
      propertyTax: Math.round(propertyTax * 100) / 100,
      otherDeductions,
      total: schedATotal,
    },
    scheduleE: {
      properties: scheduleEResults,
      totalNetIncome: Math.round(totalENet * 100) / 100,
    },
    scheduleC: {
      businesses: scheduleCResults,
      totalNetIncome: Math.round(totalCNet * 100) / 100,
    },
  }
}
