/**
 * Seed script — populates tax reference database tables.
 * These are read-only reference datasets, not user-generated data.
 * Run via the main seed script or independently with: npx tsx prisma/seed-tax-rules.ts
 */
import type { PrismaClient } from '@prisma/client'

// ─── Tax Rules ──────────────────────────────────────────────────────────────

type TaxRuleSeed = {
  ruleCode: string
  title: string
  description: string
  taxYear: number
  jurisdiction: string
  form?: string
  formLine?: string
  category: string
  subcategory?: string
  appliesTo: string[]
  propertyTypes?: string[]
  filingStatuses?: string[]
  annualLimit?: number
  incomePhaseOutStart?: number
  incomePhaseOutEnd?: number
  percentageLimit?: number
  ircSection?: string
  sourceUrl?: string
  effectiveDate?: Date
  expirationDate?: Date
  lastVerified: Date
  notes?: string
}

const FEDERAL_2025_RULES: TaxRuleSeed[] = [
  // ── Schedule E — Rental Property Deductions ──────────────────────────────
  {
    ruleCode: 'SCHED_E_REPAIRS',
    title: 'Schedule E — Repairs and Maintenance',
    description:
      'Ordinary and necessary expenses for repairs that keep rental property in good operating condition. Repairs maintain but do not add value or prolong life. Examples: fixing leaks, painting, replacing broken hardware, patching drywall. Improvements (add value or prolong life) must be capitalized and depreciated instead.',
    taxYear: 2025,
    jurisdiction: 'federal',
    form: 'Schedule E',
    formLine: 'Line 14',
    category: 'DEDUCTIONS_RENTAL',
    subcategory: 'Repairs',
    appliesTo: ['landlord'],
    propertyTypes: ['rental'],
    ircSection: '162',
    sourceUrl: 'https://www.irs.gov/instructions/i1040se',
    lastVerified: new Date('2025-02-01'),
  },
  {
    ruleCode: 'SCHED_E_INSURANCE',
    title: 'Schedule E — Insurance',
    description:
      'Premiums for fire, theft, flood, and landlord liability insurance on rental property. Does not include homeowners insurance on personal residence portion.',
    taxYear: 2025,
    jurisdiction: 'federal',
    form: 'Schedule E',
    formLine: 'Line 9',
    category: 'DEDUCTIONS_RENTAL',
    subcategory: 'Insurance',
    appliesTo: ['landlord'],
    propertyTypes: ['rental'],
    ircSection: '162',
    sourceUrl: 'https://www.irs.gov/instructions/i1040se',
    lastVerified: new Date('2025-02-01'),
  },
  {
    ruleCode: 'SCHED_E_UTILITIES',
    title: 'Schedule E — Utilities',
    description:
      'Utility costs paid by landlord for rental property: water, sewer, gas, electric, trash. If utility serves both personal and rental units (common in duplexes), must be allocated based on square footage or metered usage.',
    taxYear: 2025,
    jurisdiction: 'federal',
    form: 'Schedule E',
    formLine: 'Line 17',
    category: 'DEDUCTIONS_RENTAL',
    subcategory: 'Utilities',
    appliesTo: ['landlord'],
    propertyTypes: ['rental'],
    ircSection: '162',
    sourceUrl: 'https://www.irs.gov/instructions/i1040se',
    lastVerified: new Date('2025-02-01'),
  },
  {
    ruleCode: 'SCHED_E_MORTGAGE_INT',
    title: 'Schedule E — Mortgage Interest (Rental Portion)',
    description:
      'The rental-allocated portion of mortgage interest on a duplex. For a 50/50 square footage split, 50% of Form 1098 mortgage interest goes on Schedule E. The personal portion goes on Schedule A.',
    taxYear: 2025,
    jurisdiction: 'federal',
    form: 'Schedule E',
    formLine: 'Line 12',
    category: 'DEDUCTIONS_RENTAL',
    subcategory: 'Mortgage Interest',
    appliesTo: ['landlord'],
    propertyTypes: ['rental'],
    ircSection: '163',
    sourceUrl: 'https://www.irs.gov/instructions/i1040se',
    lastVerified: new Date('2025-02-01'),
  },
  {
    ruleCode: 'SCHED_E_PROP_TAX',
    title: 'Schedule E — Property Taxes (Rental Portion)',
    description:
      'The rental-allocated portion of real estate property taxes. Same allocation method as mortgage interest. Note: the SALT cap does NOT apply to the rental portion — only the personal portion on Schedule A is subject to the $40,000 cap.',
    taxYear: 2025,
    jurisdiction: 'federal',
    form: 'Schedule E',
    formLine: 'Line 16',
    category: 'DEDUCTIONS_RENTAL',
    subcategory: 'Taxes',
    appliesTo: ['landlord'],
    propertyTypes: ['rental'],
    ircSection: '164',
    sourceUrl: 'https://www.irs.gov/instructions/i1040se',
    lastVerified: new Date('2025-02-01'),
  },
  {
    ruleCode: 'SCHED_E_DEPRECIATION',
    title: 'Schedule E — Depreciation (Residential Rental)',
    description:
      'Residential rental property is depreciated over 27.5 years using straight-line method. Depreciation applies to the building only (not land). For a duplex, only the rental portion of the building value is depreciated. Cost segregation studies can reclassify components to shorter lives (5, 7, 15 years).',
    taxYear: 2025,
    jurisdiction: 'federal',
    form: 'Schedule E',
    formLine: 'Line 18',
    category: 'DEPRECIATION',
    subcategory: 'Residential',
    appliesTo: ['landlord'],
    propertyTypes: ['rental'],
    ircSection: '168',
    sourceUrl: 'https://www.irs.gov/pub/irs-pdf/p946.pdf',
    lastVerified: new Date('2025-02-01'),
  },
  {
    ruleCode: 'SCHED_E_LEGAL',
    title: 'Schedule E — Legal and Professional Services',
    description:
      'Attorney fees, accountant fees, property management fees, and other professional services related to the rental activity.',
    taxYear: 2025,
    jurisdiction: 'federal',
    form: 'Schedule E',
    formLine: 'Line 10',
    category: 'DEDUCTIONS_RENTAL',
    subcategory: 'Legal/Professional',
    appliesTo: ['landlord'],
    propertyTypes: ['rental'],
    ircSection: '162',
    sourceUrl: 'https://www.irs.gov/instructions/i1040se',
    lastVerified: new Date('2025-02-01'),
  },
  {
    ruleCode: 'SCHED_E_SUPPLIES',
    title: 'Schedule E — Supplies',
    description:
      'Small items and materials used in maintaining the rental property: cleaning supplies, light bulbs, smoke detector batteries, small tools, etc.',
    taxYear: 2025,
    jurisdiction: 'federal',
    form: 'Schedule E',
    formLine: 'Line 22',
    category: 'DEDUCTIONS_RENTAL',
    subcategory: 'Supplies',
    appliesTo: ['landlord'],
    propertyTypes: ['rental'],
    ircSection: '162',
    sourceUrl: 'https://www.irs.gov/instructions/i1040se',
    lastVerified: new Date('2025-02-01'),
  },

  // ── Schedule A — Personal Itemized Deductions ────────────────────────────
  {
    ruleCode: 'SCHED_A_MORTGAGE_INT',
    title: 'Schedule A — Home Mortgage Interest',
    description:
      'Interest on mortgage debt up to $750,000 (for loans originated after Dec 15, 2017) on primary and second homes. For duplex owners, this is the personal-residence portion only — rental portion goes on Schedule E.',
    taxYear: 2025,
    jurisdiction: 'federal',
    form: 'Schedule A',
    formLine: 'Line 8a',
    category: 'DEDUCTIONS_PERSONAL',
    subcategory: 'Mortgage Interest',
    appliesTo: ['homeowner'],
    propertyTypes: ['primary_residence'],
    annualLimit: 750000,
    ircSection: '163',
    sourceUrl: 'https://www.irs.gov/instructions/i1040sca',
    lastVerified: new Date('2025-02-01'),
    notes: 'Limit is on acquisition debt, not the deduction amount itself.',
  },
  {
    ruleCode: 'SALT_CAP',
    title: 'SALT Deduction Cap',
    description:
      'State and local tax deduction capped at $40,000 for married filing jointly ($20,000 single) for tax year 2025, per the 2025 tax law extension. Includes state income tax + property tax on personal residence. Rental property taxes are NOT subject to this cap (deducted on Schedule E). Critical for high-tax states like CT.',
    taxYear: 2025,
    jurisdiction: 'federal',
    form: 'Schedule A',
    formLine: 'Line 5d',
    category: 'DEDUCTIONS_PERSONAL',
    subcategory: 'SALT',
    appliesTo: ['all'],
    propertyTypes: ['primary_residence'],
    annualLimit: 40000,
    ircSection: '164',
    sourceUrl: 'https://www.irs.gov/instructions/i1040sca',
    lastVerified: new Date('2025-02-01'),
  },
  {
    ruleCode: 'SCHED_A_MEDICAL',
    title: 'Schedule A — Medical and Dental Expenses',
    description:
      'Medical and dental expenses that exceed 7.5% of AGI. Includes insurance premiums (if not pre-tax), copays, prescriptions, dental, vision, and qualifying health expenses.',
    taxYear: 2025,
    jurisdiction: 'federal',
    form: 'Schedule A',
    formLine: 'Line 4',
    category: 'DEDUCTIONS_PERSONAL',
    subcategory: 'Medical',
    appliesTo: ['all'],
    percentageLimit: 0.075,
    ircSection: '213',
    sourceUrl: 'https://www.irs.gov/instructions/i1040sca',
    lastVerified: new Date('2025-02-01'),
  },
  {
    ruleCode: 'SCHED_A_CHARITABLE',
    title: 'Schedule A — Charitable Contributions',
    description:
      'Cash and property donations to qualified organizations. Cash contributions limited to 60% of AGI. Donations over $250 require written acknowledgment. Non-cash donations over $500 require Form 8283.',
    taxYear: 2025,
    jurisdiction: 'federal',
    form: 'Schedule A',
    formLine: 'Line 12',
    category: 'DEDUCTIONS_PERSONAL',
    subcategory: 'Charitable',
    appliesTo: ['all'],
    percentageLimit: 0.6,
    ircSection: '170',
    sourceUrl: 'https://www.irs.gov/instructions/i1040sca',
    lastVerified: new Date('2025-02-01'),
  },

  // ── Standard Deduction & Brackets ────────────────────────────────────────
  {
    ruleCode: 'STD_DEDUCTION_2025',
    title: 'Standard Deduction 2025',
    description:
      'Standard deduction amounts for 2025: $15,000 single, $30,000 married filing jointly, $22,500 head of household. Additional $1,600 for blind/65+ (single) or $1,300 (married).',
    taxYear: 2025,
    jurisdiction: 'federal',
    form: '1040',
    category: 'FILING_THRESHOLDS',
    subcategory: 'Standard Deduction',
    appliesTo: ['all'],
    ircSection: '63',
    sourceUrl:
      'https://www.irs.gov/newsroom/irs-provides-tax-inflation-adjustments-for-tax-year-2025',
    lastVerified: new Date('2025-02-01'),
  },

  // ── Pass-Through / QBI ───────────────────────────────────────────────────
  {
    ruleCode: 'SEC_199A_QBI',
    title: 'Section 199A — Qualified Business Income Deduction',
    description:
      'Deduction of up to 20% of qualified business income from pass-through entities, including rental income that meets certain conditions. Extended by 2025 tax law. For rental property to qualify, the taxpayer must meet the safe harbor requirements: 250+ hours of rental services per year, separate books and records, and contemporaneous records. Phase-out begins at $191,950 (single) / $383,900 (MFJ) for specified service businesses.',
    taxYear: 2025,
    jurisdiction: 'federal',
    form: '1040',
    formLine: 'Line 13',
    category: 'PASS_THROUGH',
    subcategory: 'QBI Deduction',
    appliesTo: ['landlord', 'self_employed'],
    propertyTypes: ['rental'],
    percentageLimit: 0.2,
    incomePhaseOutStart: 191950,
    incomePhaseOutEnd: 241950,
    ircSection: '199A',
    sourceUrl:
      'https://www.irs.gov/newsroom/qualified-business-income-deduction',
    lastVerified: new Date('2025-02-01'),
    notes: 'Phase-out values are for single filers. MFJ: $383,900–$433,900.',
  },

  // ── Capital Gains / Home Sale ────────────────────────────────────────────
  {
    ruleCode: 'SEC_121_EXCLUSION',
    title: 'Section 121 — Home Sale Gain Exclusion',
    description:
      'Exclude up to $250,000 ($500,000 MFJ) of gain on sale of primary residence. Must have owned and used as primary residence for 2 of the last 5 years. For a duplex, only the personal-use portion qualifies — the rental portion is subject to capital gains tax (but may qualify for Section 1031 exchange).',
    taxYear: 2025,
    jurisdiction: 'federal',
    form: 'Schedule D',
    category: 'CAPITAL_GAINS',
    subcategory: 'Home Sale',
    appliesTo: ['homeowner'],
    propertyTypes: ['primary_residence'],
    annualLimit: 250000,
    ircSection: '121',
    sourceUrl: 'https://www.irs.gov/pub/irs-pdf/p523.pdf',
    lastVerified: new Date('2025-02-01'),
    notes: 'Limit is $500,000 for MFJ.',
  },

  // ── Retirement Contributions ─────────────────────────────────────────────
  {
    ruleCode: '401K_LIMIT_2025',
    title: '401(k) Contribution Limit 2025',
    description:
      'Employee elective deferral limit: $23,500 for 2025. Catch-up contribution for age 50+: additional $7,500 ($31,000 total). New "super catch-up" for ages 60-63: additional $11,250 ($34,750 total). Employer match does not count against employee limit.',
    taxYear: 2025,
    jurisdiction: 'federal',
    category: 'RETIREMENT',
    subcategory: '401k',
    appliesTo: ['w2_employee'],
    annualLimit: 23500,
    ircSection: '402(g)',
    sourceUrl:
      'https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-401k-and-profit-sharing-plan-contribution-limits',
    lastVerified: new Date('2025-02-01'),
    notes: 'Catch-up (50+): $7,500 extra. Super catch-up (60-63): $11,250 extra.',
  },
  {
    ruleCode: 'IRA_LIMIT_2025',
    title: 'IRA Contribution Limit 2025',
    description:
      'Traditional/Roth IRA contribution limit: $7,000 for 2025. Catch-up for 50+: additional $1,000 ($8,000 total). Roth income limits: phase-out begins at $150,000 (single) / $236,000 (MFJ). Traditional IRA deductibility phases out if covered by employer plan.',
    taxYear: 2025,
    jurisdiction: 'federal',
    category: 'RETIREMENT',
    subcategory: 'IRA',
    appliesTo: ['all'],
    annualLimit: 7000,
    incomePhaseOutStart: 150000,
    incomePhaseOutEnd: 165000,
    ircSection: '219',
    sourceUrl:
      'https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-ira-contribution-limits',
    lastVerified: new Date('2025-02-01'),
    notes: 'Phase-out values for Roth, single filers. MFJ: $236,000–$246,000.',
  },
]

const CT_2025_RULES: TaxRuleSeed[] = [
  {
    ruleCode: 'CT_INCOME_TAX',
    title: 'Connecticut Income Tax',
    description:
      'CT has a progressive income tax with rates from 2% to 6.99%. A 3% surcharge applies to taxpayers with CT AGI over $500K (single) or $1M (MFJ). CT also offers a property tax credit of up to $300 against CT income tax.',
    taxYear: 2025,
    jurisdiction: 'CT',
    form: 'CT-1040',
    category: 'STATE_SPECIFIC',
    subcategory: 'Income Tax',
    appliesTo: ['all'],
    lastVerified: new Date('2025-02-01'),
  },
  {
    ruleCode: 'CT_PROPERTY_TAX_CREDIT',
    title: 'Connecticut Property Tax Credit',
    description:
      'CT residents who pay property tax on their primary residence may claim a credit of up to $300 on their CT income tax return. Phase-out applies based on CT AGI.',
    taxYear: 2025,
    jurisdiction: 'CT',
    form: 'CT-1040',
    category: 'STATE_SPECIFIC',
    subcategory: 'Property Tax Credit',
    appliesTo: ['homeowner'],
    annualLimit: 300,
    lastVerified: new Date('2025-02-01'),
  },
]

// ─── Standard Deduction Thresholds ──────────────────────────────────────────

type ThresholdSeed = {
  filingStatus: string
  bracketFloor: number
  bracketCeiling?: number
  rate?: number
  flatAmount?: number
}

const STD_DEDUCTION_THRESHOLDS: ThresholdSeed[] = [
  { filingStatus: 'single', bracketFloor: 0, flatAmount: 15000 },
  { filingStatus: 'mfj', bracketFloor: 0, flatAmount: 30000 },
  { filingStatus: 'mfs', bracketFloor: 0, flatAmount: 15000 },
  { filingStatus: 'hoh', bracketFloor: 0, flatAmount: 22500 },
]

const SALT_CAP_THRESHOLDS: ThresholdSeed[] = [
  { filingStatus: 'single', bracketFloor: 0, flatAmount: 20000 },
  { filingStatus: 'mfj', bracketFloor: 0, flatAmount: 40000 },
  { filingStatus: 'mfs', bracketFloor: 0, flatAmount: 20000 },
  { filingStatus: 'hoh', bracketFloor: 0, flatAmount: 40000 },
]

const SEC_121_THRESHOLDS: ThresholdSeed[] = [
  { filingStatus: 'single', bracketFloor: 0, flatAmount: 250000 },
  { filingStatus: 'mfj', bracketFloor: 0, flatAmount: 500000 },
]

// ─── Deduction Category Mappings ────────────────────────────────────────────

type DeductionMappingSeed = {
  spendingCategory: string
  propertyType?: string
  form: string
  formLine?: string
  scheduleECategory?: string
  allocationMethod?: string
  defaultAllocationPct?: number
  allocationNotes?: string
  taxYear: number
}

const DEDUCTION_MAPPINGS: DeductionMappingSeed[] = [
  // Rental property mappings
  {
    spendingCategory: 'Rental Repairs',
    propertyType: 'rental',
    form: 'Schedule E',
    formLine: 'Line 14',
    scheduleECategory: 'Repairs',
    allocationMethod: 'full',
    defaultAllocationPct: 1.0,
    taxYear: 2025,
  },
  {
    spendingCategory: 'Rental Insurance',
    propertyType: 'rental',
    form: 'Schedule E',
    formLine: 'Line 9',
    scheduleECategory: 'Insurance',
    allocationMethod: 'full',
    defaultAllocationPct: 1.0,
    taxYear: 2025,
  },
  {
    spendingCategory: 'Rental Utilities',
    propertyType: 'rental',
    form: 'Schedule E',
    formLine: 'Line 17',
    scheduleECategory: 'Utilities',
    allocationMethod: 'full',
    defaultAllocationPct: 1.0,
    taxYear: 2025,
  },
  {
    spendingCategory: 'Rental Property',
    propertyType: 'rental',
    form: 'Schedule E',
    scheduleECategory: 'Other',
    allocationMethod: 'full',
    defaultAllocationPct: 1.0,
    taxYear: 2025,
  },

  // Shared/split expenses (duplex)
  {
    spendingCategory: 'Mortgage',
    propertyType: 'personal',
    form: 'Schedule A',
    formLine: 'Line 8a',
    allocationMethod: 'sqft_split',
    defaultAllocationPct: 0.5,
    allocationNotes: 'Personal portion of duplex mortgage interest',
    taxYear: 2025,
  },
  {
    spendingCategory: 'Mortgage',
    propertyType: 'rental',
    form: 'Schedule E',
    formLine: 'Line 12',
    scheduleECategory: 'Mortgage Interest',
    allocationMethod: 'sqft_split',
    defaultAllocationPct: 0.5,
    allocationNotes: 'Rental portion of duplex mortgage interest',
    taxYear: 2025,
  },
  {
    spendingCategory: 'Electric',
    propertyType: 'personal',
    form: 'N/A',
    allocationMethod: 'sqft_split',
    defaultAllocationPct: 0.5,
    allocationNotes: 'Personal portion — not deductible unless home office',
    taxYear: 2025,
  },
  {
    spendingCategory: 'Electric',
    propertyType: 'rental',
    form: 'Schedule E',
    formLine: 'Line 17',
    scheduleECategory: 'Utilities',
    allocationMethod: 'sqft_split',
    defaultAllocationPct: 0.5,
    allocationNotes: 'Rental portion of shared electric bill',
    taxYear: 2025,
  },
  {
    spendingCategory: 'Home Improvement',
    propertyType: 'personal',
    form: 'N/A',
    allocationMethod: 'manual',
    allocationNotes: 'Personal improvements — not deductible (may add to cost basis)',
    taxYear: 2025,
  },
  {
    spendingCategory: 'Home Improvement',
    propertyType: 'rental',
    form: 'Schedule E',
    formLine: 'Line 14',
    scheduleECategory: 'Repairs',
    allocationMethod: 'manual',
    allocationNotes:
      'Rental improvements — repairs deductible, improvements capitalized',
    taxYear: 2025,
  },

  // Personal deductions
  {
    spendingCategory: 'Medical',
    propertyType: 'personal',
    form: 'Schedule A',
    formLine: 'Line 4',
    allocationMethod: 'full',
    defaultAllocationPct: 1.0,
    allocationNotes: 'Subject to 7.5% AGI floor',
    taxYear: 2025,
  },

  // Non-deductible spending (included for completeness — no tax form)
  {
    spendingCategory: 'Subscriptions',
    form: 'N/A',
    taxYear: 2025,
  },
  {
    spendingCategory: 'Groceries',
    form: 'N/A',
    taxYear: 2025,
  },
  {
    spendingCategory: 'Restaurants',
    form: 'N/A',
    taxYear: 2025,
  },
]

// ─── Tax Calendar ───────────────────────────────────────────────────────────

type TaxCalendarSeed = {
  taxYear: number
  eventName: string
  eventDate: Date
  eventType: string
  description: string
  appliesTo: string[]
  actionRequired?: string
}

const TAX_CALENDAR_ENTRIES: TaxCalendarSeed[] = [
  {
    taxYear: 2025,
    eventName: 'Q1 Estimated Tax Payment Due',
    eventDate: new Date('2025-04-15'),
    eventType: 'deadline',
    description: 'First quarterly estimated tax payment for 2025',
    appliesTo: ['landlord', 'self_employed'],
    actionRequired: 'Pay via IRS Direct Pay or EFTPS',
  },
  {
    taxYear: 2025,
    eventName: 'Q2 Estimated Tax Payment Due',
    eventDate: new Date('2025-06-16'),
    eventType: 'deadline',
    description: 'Second quarterly estimated tax payment for 2025',
    appliesTo: ['landlord', 'self_employed'],
    actionRequired: 'Pay via IRS Direct Pay or EFTPS',
  },
  {
    taxYear: 2025,
    eventName: 'Q3 Estimated Tax Payment Due',
    eventDate: new Date('2025-09-15'),
    eventType: 'deadline',
    description: 'Third quarterly estimated tax payment for 2025',
    appliesTo: ['landlord', 'self_employed'],
    actionRequired: 'Pay via IRS Direct Pay or EFTPS',
  },
  {
    taxYear: 2025,
    eventName: 'Q4 Estimated Tax Payment Due',
    eventDate: new Date('2026-01-15'),
    eventType: 'deadline',
    description: 'Fourth quarterly estimated tax payment for 2025',
    appliesTo: ['landlord', 'self_employed'],
    actionRequired: 'Pay via IRS Direct Pay or EFTPS',
  },
  {
    taxYear: 2025,
    eventName: 'Year-End Tax Optimization Window',
    eventDate: new Date('2025-12-01'),
    eventType: 'opportunity',
    description:
      'Last month to accelerate deductions, make charitable contributions, harvest tax losses, or make retirement contributions for the tax year',
    appliesTo: ['all'],
    actionRequired:
      'Review YTD spending and identify optimization opportunities',
  },
  {
    taxYear: 2025,
    eventName: '401(k) Contribution Deadline',
    eventDate: new Date('2025-12-31'),
    eventType: 'deadline',
    description: 'Last day to make 401(k) elective deferrals for 2025',
    appliesTo: ['w2_employee'],
    actionRequired: 'Verify contribution level with HR/payroll',
  },
  {
    taxYear: 2025,
    eventName: 'IRA Contribution Deadline',
    eventDate: new Date('2026-04-15'),
    eventType: 'deadline',
    description: 'Last day to make IRA contributions for tax year 2025',
    appliesTo: ['all'],
    actionRequired: 'Contribute to Traditional or Roth IRA',
  },
  {
    taxYear: 2026,
    eventName: 'Tax Filing Deadline',
    eventDate: new Date('2026-04-15'),
    eventType: 'deadline',
    description: 'Federal income tax return due for 2025',
    appliesTo: ['all'],
    actionRequired: 'File Form 1040 or request extension (Form 4868)',
  },
  {
    taxYear: 2025,
    eventName: 'CT Estimated Tax Q1',
    eventDate: new Date('2025-04-15'),
    eventType: 'deadline',
    description: 'CT quarterly estimated tax payment',
    appliesTo: ['all'],
    actionRequired: 'Pay via CT DRS myconneCT portal',
  },
]

// ─── Seeder Function ────────────────────────────────────────────────────────

export async function seedTaxRules(db: PrismaClient): Promise<void> {
  console.log('  Seeding tax rules...')

  // Upsert all federal + state rules
  const allRules = [...FEDERAL_2025_RULES, ...CT_2025_RULES]
  for (const rule of allRules) {
    await db.taxRule.upsert({
      where: { ruleCode: rule.ruleCode },
      update: {
        title: rule.title,
        description: rule.description,
        taxYear: rule.taxYear,
        jurisdiction: rule.jurisdiction,
        form: rule.form ?? null,
        formLine: rule.formLine ?? null,
        category: rule.category,
        subcategory: rule.subcategory ?? null,
        appliesTo: rule.appliesTo,
        propertyTypes: rule.propertyTypes ?? [],
        filingStatuses: rule.filingStatuses ?? [],
        annualLimit: rule.annualLimit ?? null,
        incomePhaseOutStart: rule.incomePhaseOutStart ?? null,
        incomePhaseOutEnd: rule.incomePhaseOutEnd ?? null,
        percentageLimit: rule.percentageLimit ?? null,
        ircSection: rule.ircSection ?? null,
        sourceUrl: rule.sourceUrl ?? null,
        effectiveDate: rule.effectiveDate ?? null,
        expirationDate: rule.expirationDate ?? null,
        lastVerified: rule.lastVerified,
        notes: rule.notes ?? null,
      },
      create: {
        ruleCode: rule.ruleCode,
        title: rule.title,
        description: rule.description,
        taxYear: rule.taxYear,
        jurisdiction: rule.jurisdiction,
        form: rule.form ?? null,
        formLine: rule.formLine ?? null,
        category: rule.category,
        subcategory: rule.subcategory ?? null,
        appliesTo: rule.appliesTo,
        propertyTypes: rule.propertyTypes ?? [],
        filingStatuses: rule.filingStatuses ?? [],
        annualLimit: rule.annualLimit ?? null,
        incomePhaseOutStart: rule.incomePhaseOutStart ?? null,
        incomePhaseOutEnd: rule.incomePhaseOutEnd ?? null,
        percentageLimit: rule.percentageLimit ?? null,
        ircSection: rule.ircSection ?? null,
        sourceUrl: rule.sourceUrl ?? null,
        effectiveDate: rule.effectiveDate ?? null,
        expirationDate: rule.expirationDate ?? null,
        lastVerified: rule.lastVerified,
        notes: rule.notes ?? null,
      },
    })
  }
  console.log(`    ✓ ${allRules.length} tax rules upserted`)

  // Seed thresholds for rules that have them
  const thresholdGroups: { ruleCode: string; thresholds: ThresholdSeed[] }[] = [
    { ruleCode: 'STD_DEDUCTION_2025', thresholds: STD_DEDUCTION_THRESHOLDS },
    { ruleCode: 'SALT_CAP', thresholds: SALT_CAP_THRESHOLDS },
    { ruleCode: 'SEC_121_EXCLUSION', thresholds: SEC_121_THRESHOLDS },
  ]

  let thresholdCount = 0
  for (const group of thresholdGroups) {
    const rule = await db.taxRule.findUnique({
      where: { ruleCode: group.ruleCode },
    })
    if (!rule) continue

    // Delete existing thresholds for this rule, then re-create
    await db.taxRuleThreshold.deleteMany({
      where: { taxRuleId: rule.id },
    })

    for (const t of group.thresholds) {
      await db.taxRuleThreshold.create({
        data: {
          taxRuleId: rule.id,
          filingStatus: t.filingStatus,
          bracketFloor: t.bracketFloor,
          bracketCeiling: t.bracketCeiling ?? null,
          rate: t.rate ?? null,
          flatAmount: t.flatAmount ?? null,
        },
      })
      thresholdCount++
    }
  }
  console.log(`    ✓ ${thresholdCount} tax rule thresholds created`)

  // Seed deduction category mappings
  // Clear and re-seed for the tax year
  await db.deductionCategoryMapping.deleteMany({
    where: { taxYear: 2025 },
  })

  for (const mapping of DEDUCTION_MAPPINGS) {
    // Look up linked tax rule if the form points to Schedule E or Schedule A
    let taxRuleId: string | null = null
    if (mapping.form === 'Schedule E' && mapping.formLine) {
      const rule = await db.taxRule.findFirst({
        where: {
          form: 'Schedule E',
          formLine: mapping.formLine,
          taxYear: mapping.taxYear,
        },
      })
      taxRuleId = rule?.id ?? null
    } else if (mapping.form === 'Schedule A' && mapping.formLine) {
      const rule = await db.taxRule.findFirst({
        where: {
          form: 'Schedule A',
          formLine: mapping.formLine,
          taxYear: mapping.taxYear,
        },
      })
      taxRuleId = rule?.id ?? null
    }

    await db.deductionCategoryMapping.create({
      data: {
        spendingCategory: mapping.spendingCategory,
        propertyType: mapping.propertyType ?? null,
        taxRuleId,
        form: mapping.form,
        formLine: mapping.formLine ?? null,
        scheduleECategory: mapping.scheduleECategory ?? null,
        allocationMethod: mapping.allocationMethod ?? null,
        defaultAllocationPct: mapping.defaultAllocationPct ?? null,
        allocationNotes: mapping.allocationNotes ?? null,
        taxYear: mapping.taxYear,
      },
    })
  }
  console.log(`    ✓ ${DEDUCTION_MAPPINGS.length} deduction category mappings created`)

  // Seed tax calendar
  await db.taxCalendar.deleteMany({
    where: { taxYear: { in: [2025, 2026] } },
  })

  for (const entry of TAX_CALENDAR_ENTRIES) {
    await db.taxCalendar.create({
      data: {
        taxYear: entry.taxYear,
        eventName: entry.eventName,
        eventDate: entry.eventDate,
        eventType: entry.eventType,
        description: entry.description,
        appliesTo: entry.appliesTo,
        actionRequired: entry.actionRequired ?? null,
      },
    })
  }
  console.log(`    ✓ ${TAX_CALENDAR_ENTRIES.length} tax calendar entries created`)
}
