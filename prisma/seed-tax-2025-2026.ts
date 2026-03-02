/**
 * Federal Tax Rules Seed Data — 2025 + 2026
 *
 * Sources:
 *
 * IRS inflation adjustments: https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026
 *
 * Tax Foundation 2025 brackets: https://taxfoundation.org/data/all/federal/2025-tax-brackets/
 *
 * Fidelity 2025-2026 brackets: https://www.fidelity.com/learning-center/personal-finance/tax-brackets
 *
 * SALT changes (One Big Beautiful Bill): https://bipartisanpolicy.org/article/how-would-the-2025-house-tax-bill-change-the-salt-deduction/
 *
 * Standard deduction 2025-2026: https://www.nerdwallet.com/taxes/learn/standard-deduction
 *
 * Mortgage interest: https://www.irs.gov/publications/p936
 *
 * Estimated tax deadlines: https://www.kiplinger.com/taxes/tax-deadline/602538/when-estimated-tax-payments-due
 *
 * IMPORTANT: These are the rules as of March 2026, incorporating the One Big Beautiful Bill Act
 * (OBBBA) signed July 4, 2025. Rules may change — verify annually.
 *
 * Run via the main seed script or independently with: npx tsx prisma/seed-tax-2025-2026.ts
 */
import type { PrismaClient } from '@prisma/client'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface TaxRuleSeed {
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
  propertyTypes: string[]
  filingStatuses: string[]
  annualLimit?: number
  incomePhaseOutStart?: number
  incomePhaseOutEnd?: number
  percentageLimit?: number
  ircSection?: string
  notes?: string
  thresholds?: TaxThresholdSeed[]
}

interface TaxThresholdSeed {
  filingStatus: string
  bracketFloor: number
  bracketCeiling?: number
  rate?: number
  flatAmount?: number
}

interface DeductionMappingSeed {
  spendingCategory: string
  propertyType?: string
  form: string
  formLine?: string
  scheduleECategory?: string
  allocationMethod?: string
  defaultAllocationPct?: number
  allocationNotes?: string
  requiresReceipt: boolean
  taxYear: number
}

interface TaxCalendarSeed {
  taxYear: number
  eventName: string
  eventDate: string
  eventType: string
  description?: string
  appliesTo: string[]
  actionRequired?: string
}

// ─── 2025 Income Tax Brackets ─────────────────────────────────────────────────

const BRACKETS_2025: TaxRuleSeed = {
  ruleCode: 'FED_INCOME_BRACKETS_2025',
  title: '2025 Federal Income Tax Brackets',
  description: 'Seven-bracket progressive income tax system for tax year 2025',
  taxYear: 2025,
  jurisdiction: 'federal',
  form: '1040',
  category: 'INCOME_TAX',
  appliesTo: ['all'],
  propertyTypes: [],
  filingStatuses: ['single', 'mfj', 'mfs', 'hoh'],
  ircSection: '1',
  thresholds: [
    // Single
    { filingStatus: 'single', bracketFloor: 0, bracketCeiling: 11925, rate: 0.10 },
    { filingStatus: 'single', bracketFloor: 11926, bracketCeiling: 48475, rate: 0.12 },
    { filingStatus: 'single', bracketFloor: 48476, bracketCeiling: 103350, rate: 0.22 },
    { filingStatus: 'single', bracketFloor: 103351, bracketCeiling: 197300, rate: 0.24 },
    { filingStatus: 'single', bracketFloor: 197301, bracketCeiling: 250525, rate: 0.32 },
    { filingStatus: 'single', bracketFloor: 250526, bracketCeiling: 626350, rate: 0.35 },
    { filingStatus: 'single', bracketFloor: 626351, rate: 0.37 },
    // Married Filing Jointly
    { filingStatus: 'mfj', bracketFloor: 0, bracketCeiling: 23850, rate: 0.10 },
    { filingStatus: 'mfj', bracketFloor: 23851, bracketCeiling: 96950, rate: 0.12 },
    { filingStatus: 'mfj', bracketFloor: 96951, bracketCeiling: 206700, rate: 0.22 },
    { filingStatus: 'mfj', bracketFloor: 206701, bracketCeiling: 394600, rate: 0.24 },
    { filingStatus: 'mfj', bracketFloor: 394601, bracketCeiling: 501050, rate: 0.32 },
    { filingStatus: 'mfj', bracketFloor: 501051, bracketCeiling: 751600, rate: 0.35 },
    { filingStatus: 'mfj', bracketFloor: 751601, rate: 0.37 },
    // Head of Household
    { filingStatus: 'hoh', bracketFloor: 0, bracketCeiling: 17000, rate: 0.10 },
    { filingStatus: 'hoh', bracketFloor: 17001, bracketCeiling: 64850, rate: 0.12 },
    { filingStatus: 'hoh', bracketFloor: 64851, bracketCeiling: 103350, rate: 0.22 },
    { filingStatus: 'hoh', bracketFloor: 103351, bracketCeiling: 197300, rate: 0.24 },
    { filingStatus: 'hoh', bracketFloor: 197301, bracketCeiling: 250500, rate: 0.32 },
    { filingStatus: 'hoh', bracketFloor: 250501, bracketCeiling: 626350, rate: 0.35 },
    { filingStatus: 'hoh', bracketFloor: 626351, rate: 0.37 },
  ],
}

// ─── 2026 Income Tax Brackets ─────────────────────────────────────────────────

const BRACKETS_2026: TaxRuleSeed = {
  ruleCode: 'FED_INCOME_BRACKETS_2026',
  title: '2026 Federal Income Tax Brackets',
  description: 'Seven-bracket progressive income tax system for tax year 2026',
  taxYear: 2026,
  jurisdiction: 'federal',
  form: '1040',
  category: 'INCOME_TAX',
  appliesTo: ['all'],
  propertyTypes: [],
  filingStatuses: ['single', 'mfj', 'mfs', 'hoh'],
  ircSection: '1',
  thresholds: [
    // Single
    { filingStatus: 'single', bracketFloor: 0, bracketCeiling: 12400, rate: 0.10 },
    { filingStatus: 'single', bracketFloor: 12401, bracketCeiling: 50400, rate: 0.12 },
    { filingStatus: 'single', bracketFloor: 50401, bracketCeiling: 105700, rate: 0.22 },
    { filingStatus: 'single', bracketFloor: 105701, bracketCeiling: 201775, rate: 0.24 },
    { filingStatus: 'single', bracketFloor: 201776, bracketCeiling: 256225, rate: 0.32 },
    { filingStatus: 'single', bracketFloor: 256226, bracketCeiling: 640600, rate: 0.35 },
    { filingStatus: 'single', bracketFloor: 640601, rate: 0.37 },
    // Married Filing Jointly
    { filingStatus: 'mfj', bracketFloor: 0, bracketCeiling: 24800, rate: 0.10 },
    { filingStatus: 'mfj', bracketFloor: 24801, bracketCeiling: 100800, rate: 0.12 },
    { filingStatus: 'mfj', bracketFloor: 100801, bracketCeiling: 211400, rate: 0.22 },
    { filingStatus: 'mfj', bracketFloor: 211401, bracketCeiling: 403550, rate: 0.24 },
    { filingStatus: 'mfj', bracketFloor: 403551, bracketCeiling: 512450, rate: 0.32 },
    { filingStatus: 'mfj', bracketFloor: 512451, bracketCeiling: 768700, rate: 0.35 },
    { filingStatus: 'mfj', bracketFloor: 768701, rate: 0.37 },
    // Head of Household
    { filingStatus: 'hoh', bracketFloor: 0, bracketCeiling: 17700, rate: 0.10 },
    { filingStatus: 'hoh', bracketFloor: 17701, bracketCeiling: 67400, rate: 0.12 },
    { filingStatus: 'hoh', bracketFloor: 67401, bracketCeiling: 105700, rate: 0.22 },
    { filingStatus: 'hoh', bracketFloor: 105701, bracketCeiling: 201775, rate: 0.24 },
    { filingStatus: 'hoh', bracketFloor: 201776, bracketCeiling: 256225, rate: 0.32 },
    { filingStatus: 'hoh', bracketFloor: 256226, bracketCeiling: 640600, rate: 0.35 },
    { filingStatus: 'hoh', bracketFloor: 640601, rate: 0.37 },
  ],
}

// ─── Standard Deduction ───────────────────────────────────────────────────────

const STANDARD_DEDUCTION_2025: TaxRuleSeed = {
  ruleCode: 'FED_STANDARD_DEDUCTION_2025',
  title: '2025 Standard Deduction',
  description: 'Standard deduction amounts for tax year 2025 (post-OBBBA)',
  taxYear: 2025,
  jurisdiction: 'federal',
  form: '1040',
  category: 'DEDUCTIONS_STANDARD',
  appliesTo: ['all'],
  propertyTypes: [],
  filingStatuses: ['single', 'mfj', 'mfs', 'hoh'],
  ircSection: '63',
  notes: 'Updated by One Big Beautiful Bill Act (OBBBA), signed July 4, 2025',
  thresholds: [
    { filingStatus: 'single', bracketFloor: 0, flatAmount: 15750 },
    { filingStatus: 'mfj', bracketFloor: 0, flatAmount: 31500 },
    { filingStatus: 'mfs', bracketFloor: 0, flatAmount: 15750 },
    { filingStatus: 'hoh', bracketFloor: 0, flatAmount: 23625 },
  ],
}

const STANDARD_DEDUCTION_2026: TaxRuleSeed = {
  ruleCode: 'FED_STANDARD_DEDUCTION_2026',
  title: '2026 Standard Deduction',
  description: 'Standard deduction amounts for tax year 2026',
  taxYear: 2026,
  jurisdiction: 'federal',
  form: '1040',
  category: 'DEDUCTIONS_STANDARD',
  appliesTo: ['all'],
  propertyTypes: [],
  filingStatuses: ['single', 'mfj', 'mfs', 'hoh'],
  ircSection: '63',
  thresholds: [
    { filingStatus: 'single', bracketFloor: 0, flatAmount: 16100 },
    { filingStatus: 'mfj', bracketFloor: 0, flatAmount: 32200 },
    { filingStatus: 'mfs', bracketFloor: 0, flatAmount: 16100 },
    { filingStatus: 'hoh', bracketFloor: 0, flatAmount: 24150 },
  ],
}

// ─── SALT Deduction ───────────────────────────────────────────────────────────

const SALT_2025: TaxRuleSeed = {
  ruleCode: 'FED_SALT_DEDUCTION_2025',
  title: '2025 SALT Deduction Cap',
  description: 'State and local tax deduction capped at $40,000 (up from $10,000), with phase-out above $500K MAGI',
  taxYear: 2025,
  jurisdiction: 'federal',
  form: 'Schedule A',
  formLine: 'Line 5d',
  category: 'DEDUCTIONS_ITEMIZED',
  subcategory: 'SALT',
  appliesTo: ['homeowner', 'all'],
  propertyTypes: ['personal'],
  filingStatuses: ['single', 'mfj', 'mfs', 'hoh'],
  annualLimit: 40000,
  incomePhaseOutStart: 500000,
  incomePhaseOutEnd: 600000,
  ircSection: '164',
  notes: 'OBBBA raised cap from $10K to $40K. Phase-out: $500K-$600K MAGI ($250K-$300K MFS). Reverts to $10K after 2029. Cap rises 1%/year.',
}

const SALT_2026: TaxRuleSeed = {
  ...SALT_2025,
  ruleCode: 'FED_SALT_DEDUCTION_2026',
  title: '2026 SALT Deduction Cap',
  taxYear: 2026,
  annualLimit: 40400,
  notes: 'SALT cap $40,400 (1% increase from 2025 $40,000). Same phase-out rules.',
}

// ─── Mortgage Interest Deduction ──────────────────────────────────────────────

const MORTGAGE_INTEREST_2025: TaxRuleSeed = {
  ruleCode: 'FED_MORTGAGE_INTEREST_2025',
  title: '2025 Mortgage Interest Deduction',
  description: 'Deduct interest on up to $750,000 of mortgage debt ($375,000 MFS). Permanent under OBBBA.',
  taxYear: 2025,
  jurisdiction: 'federal',
  form: 'Schedule A',
  formLine: 'Line 8a',
  category: 'DEDUCTIONS_ITEMIZED',
  subcategory: 'MORTGAGE_INTEREST',
  appliesTo: ['homeowner'],
  propertyTypes: ['personal'],
  filingStatuses: ['single', 'mfj', 'mfs', 'hoh'],
  annualLimit: 750000,
  ircSection: '163(h)',
  notes: 'Limit is on acquisition debt, not deduction amount. Made permanent by OBBBA. MFS limit: $375,000.',
}

const MORTGAGE_INTEREST_2026: TaxRuleSeed = {
  ...MORTGAGE_INTEREST_2025,
  ruleCode: 'FED_MORTGAGE_INTEREST_2026',
  title: '2026 Mortgage Interest Deduction',
  taxYear: 2026,
}

// ─── Child Tax Credit ─────────────────────────────────────────────────────────

const CHILD_TAX_CREDIT_2025: TaxRuleSeed = {
  ruleCode: 'FED_CHILD_TAX_CREDIT_2025',
  title: '2025 Child Tax Credit',
  description: '$2,000 per qualifying child under 17',
  taxYear: 2025,
  jurisdiction: 'federal',
  form: '1040',
  category: 'CREDITS',
  subcategory: 'CHILD_TAX_CREDIT',
  appliesTo: ['all'],
  propertyTypes: [],
  filingStatuses: ['single', 'mfj', 'mfs', 'hoh'],
  annualLimit: 2000,
  incomePhaseOutStart: 200000,
  ircSection: '24',
  notes: 'Phase-out: $200K single, $400K MFJ. Increases to $2,200 in 2026.',
  thresholds: [
    { filingStatus: 'single', bracketFloor: 200000, rate: 0.05 },
    { filingStatus: 'mfj', bracketFloor: 400000, rate: 0.05 },
  ],
}

const CHILD_TAX_CREDIT_2026: TaxRuleSeed = {
  ...CHILD_TAX_CREDIT_2025,
  ruleCode: 'FED_CHILD_TAX_CREDIT_2026',
  title: '2026 Child Tax Credit',
  description: '$2,200 per qualifying child under 17 (increased by OBBBA, indexed to inflation)',
  taxYear: 2026,
  annualLimit: 2200,
  notes: 'Increased from $2,000 to $2,200 by OBBBA. Now indexed to inflation annually.',
}

// ─── Schedule E — Rental Property Deductions ──────────────────────────────────

const SCHED_E_RENTAL_DEDUCTIONS: TaxRuleSeed[] = [
  {
    ruleCode: 'SCHED_E_MORTGAGE_INTEREST',
    title: 'Rental Property Mortgage Interest',
    description: 'Deduct mortgage interest paid on rental property',
    taxYear: 2025,
    jurisdiction: 'federal',
    form: 'Schedule E',
    formLine: 'Line 12',
    category: 'DEDUCTIONS_RENTAL',
    appliesTo: ['landlord'],
    propertyTypes: ['rental'],
    filingStatuses: ['single', 'mfj', 'mfs', 'hoh'],
    ircSection: '163',
    notes: 'No $750K debt limit for rental properties (that\'s personal residence only). Full interest deduction for rental.',
  },
  {
    ruleCode: 'SCHED_E_PROPERTY_TAX',
    title: 'Rental Property Taxes',
    description: 'Deduct property taxes paid on rental property',
    taxYear: 2025,
    jurisdiction: 'federal',
    form: 'Schedule E',
    formLine: 'Line 16',
    category: 'DEDUCTIONS_RENTAL',
    appliesTo: ['landlord'],
    propertyTypes: ['rental'],
    filingStatuses: ['single', 'mfj', 'mfs', 'hoh'],
    ircSection: '164',
    notes: 'SALT cap does NOT apply to rental property taxes — only personal residence. Full deduction on Schedule E.',
  },
  {
    ruleCode: 'SCHED_E_INSURANCE',
    title: 'Rental Property Insurance',
    description: 'Deduct insurance premiums for rental property',
    taxYear: 2025,
    jurisdiction: 'federal',
    form: 'Schedule E',
    formLine: 'Line 9',
    category: 'DEDUCTIONS_RENTAL',
    appliesTo: ['landlord'],
    propertyTypes: ['rental'],
    filingStatuses: ['single', 'mfj', 'mfs', 'hoh'],
  },
  {
    ruleCode: 'SCHED_E_REPAIRS',
    title: 'Rental Property Repairs & Maintenance',
    description: 'Deduct ordinary and necessary repair costs for rental property',
    taxYear: 2025,
    jurisdiction: 'federal',
    form: 'Schedule E',
    formLine: 'Line 14',
    category: 'DEDUCTIONS_RENTAL',
    appliesTo: ['landlord'],
    propertyTypes: ['rental'],
    filingStatuses: ['single', 'mfj', 'mfs', 'hoh'],
    notes: 'Must be repairs (restore to condition), not improvements (add value). Improvements must be capitalized and depreciated.',
  },
  {
    ruleCode: 'SCHED_E_DEPRECIATION',
    title: 'Rental Property Depreciation',
    description: 'Depreciate residential rental property over 27.5 years, straight-line',
    taxYear: 2025,
    jurisdiction: 'federal',
    form: 'Schedule E',
    formLine: 'Line 18',
    category: 'DEDUCTIONS_RENTAL',
    appliesTo: ['landlord'],
    propertyTypes: ['rental'],
    filingStatuses: ['single', 'mfj', 'mfs', 'hoh'],
    ircSection: '168',
    notes: '27.5-year recovery, straight-line, mid-month convention. Building value only (not land). Depreciation recapture at 25% on sale (Section 1250).',
  },
  {
    ruleCode: 'SCHED_E_UTILITIES',
    title: 'Rental Property Utilities',
    description: 'Deduct utilities paid by landlord for rental property',
    taxYear: 2025,
    jurisdiction: 'federal',
    form: 'Schedule E',
    formLine: 'Line 17',
    category: 'DEDUCTIONS_RENTAL',
    appliesTo: ['landlord'],
    propertyTypes: ['rental'],
    filingStatuses: ['single', 'mfj', 'mfs', 'hoh'],
  },
  {
    ruleCode: 'SCHED_E_MANAGEMENT',
    title: 'Rental Property Management Fees',
    description: 'Deduct property management fees and expenses',
    taxYear: 2025,
    jurisdiction: 'federal',
    form: 'Schedule E',
    formLine: 'Line 19',
    category: 'DEDUCTIONS_RENTAL',
    appliesTo: ['landlord'],
    propertyTypes: ['rental'],
    filingStatuses: ['single', 'mfj', 'mfs', 'hoh'],
  },
  {
    ruleCode: 'SCHED_E_TRAVEL',
    title: 'Rental Property Travel Expenses',
    description: 'Deduct travel expenses related to rental property management',
    taxYear: 2025,
    jurisdiction: 'federal',
    form: 'Schedule E',
    formLine: 'Line 19',
    category: 'DEDUCTIONS_RENTAL',
    appliesTo: ['landlord'],
    propertyTypes: ['rental'],
    filingStatuses: ['single', 'mfj', 'mfs', 'hoh'],
    notes: 'IRS standard mileage rate for 2025: $0.70/mile. Must be for rental management, not commuting.',
  },
  {
    ruleCode: 'SCHED_E_PASSIVE_LOSS',
    title: 'Rental Property Passive Activity Loss',
    description: 'Up to $25,000 of rental losses can offset active income if AGI < $100K',
    taxYear: 2025,
    jurisdiction: 'federal',
    form: 'Schedule E',
    category: 'DEDUCTIONS_RENTAL',
    subcategory: 'PASSIVE_LOSS',
    appliesTo: ['landlord'],
    propertyTypes: ['rental'],
    filingStatuses: ['single', 'mfj', 'mfs', 'hoh'],
    annualLimit: 25000,
    incomePhaseOutStart: 100000,
    incomePhaseOutEnd: 150000,
    ircSection: '469',
    notes: 'Phase-out: $100K-$150K MAGI. Must actively participate. MFS gets $0 unless lived apart all year.',
  },
]

// ─── Schedule C — Business Deductions ─────────────────────────────────────────

const SCHED_C_BUSINESS_DEDUCTIONS: TaxRuleSeed[] = [
  {
    ruleCode: 'SCHED_C_SOFTWARE',
    title: 'Business Software & SaaS',
    description: 'Deduct software subscriptions and SaaS tools used for business',
    taxYear: 2025,
    jurisdiction: 'federal',
    form: 'Schedule C',
    formLine: 'Line 18 (Office expense) or Line 27a (Other)',
    category: 'DEDUCTIONS_BUSINESS',
    appliesTo: ['self_employed'],
    propertyTypes: ['business'],
    filingStatuses: ['single', 'mfj', 'mfs', 'hoh'],
    notes: 'Includes hosting (Vercel, AWS), domains, development tools, design tools, etc.',
  },
  {
    ruleCode: 'SCHED_C_OFFICE_SUPPLIES',
    title: 'Business Office Supplies & Equipment',
    description: 'Deduct office supplies and equipment under $2,500 (de minimis safe harbor)',
    taxYear: 2025,
    jurisdiction: 'federal',
    form: 'Schedule C',
    formLine: 'Line 18',
    category: 'DEDUCTIONS_BUSINESS',
    appliesTo: ['self_employed'],
    propertyTypes: ['business'],
    filingStatuses: ['single', 'mfj', 'mfs', 'hoh'],
    annualLimit: 2500,
    notes: 'Items over $2,500 must be capitalized and depreciated. Section 179 may allow full deduction.',
  },
  {
    ruleCode: 'SCHED_C_PROFESSIONAL',
    title: 'Business Professional Services',
    description: 'Deduct legal, accounting, and consulting fees for business',
    taxYear: 2025,
    jurisdiction: 'federal',
    form: 'Schedule C',
    formLine: 'Line 17',
    category: 'DEDUCTIONS_BUSINESS',
    appliesTo: ['self_employed'],
    propertyTypes: ['business'],
    filingStatuses: ['single', 'mfj', 'mfs', 'hoh'],
  },
  {
    ruleCode: 'SCHED_C_ADVERTISING',
    title: 'Business Advertising & Marketing',
    description: 'Deduct advertising, marketing, and promotional expenses',
    taxYear: 2025,
    jurisdiction: 'federal',
    form: 'Schedule C',
    formLine: 'Line 8',
    category: 'DEDUCTIONS_BUSINESS',
    appliesTo: ['self_employed'],
    propertyTypes: ['business'],
    filingStatuses: ['single', 'mfj', 'mfs', 'hoh'],
  },
  {
    ruleCode: 'SCHED_C_EDUCATION',
    title: 'Business Education & Training',
    description: 'Deduct education that maintains or improves skills for current business',
    taxYear: 2025,
    jurisdiction: 'federal',
    form: 'Schedule C',
    formLine: 'Line 27a (Other)',
    category: 'DEDUCTIONS_BUSINESS',
    appliesTo: ['self_employed'],
    propertyTypes: ['business'],
    filingStatuses: ['single', 'mfj', 'mfs', 'hoh'],
    notes: 'Must relate to current business. Education to qualify for a new business is NOT deductible.',
  },
  {
    ruleCode: 'SCHED_C_HOME_OFFICE',
    title: 'Home Office Deduction',
    description: 'Simplified method: $5/sq ft, max 300 sq ft ($1,500 max). Or actual expenses prorated.',
    taxYear: 2025,
    jurisdiction: 'federal',
    form: 'Schedule C',
    formLine: 'Line 30',
    category: 'DEDUCTIONS_BUSINESS',
    subcategory: 'HOME_OFFICE',
    appliesTo: ['self_employed'],
    propertyTypes: ['business'],
    filingStatuses: ['single', 'mfj', 'mfs', 'hoh'],
    annualLimit: 1500,
    ircSection: '280A',
    notes: 'Simplified: $5/sq ft, max 300 sq ft = $1,500. Regular method: actual expenses × (office sq ft / home sq ft). Must be regular and exclusive use.',
  },
  {
    ruleCode: 'SCHED_C_SE_TAX',
    title: 'Self-Employment Tax',
    description: '15.3% on net SE income (12.4% Social Security + 2.9% Medicare). Deduct employer half.',
    taxYear: 2025,
    jurisdiction: 'federal',
    form: 'Schedule SE',
    category: 'DEDUCTIONS_BUSINESS',
    subcategory: 'SELF_EMPLOYMENT_TAX',
    appliesTo: ['self_employed'],
    propertyTypes: ['business'],
    filingStatuses: ['single', 'mfj', 'mfs', 'hoh'],
    percentageLimit: 0.153,
    ircSection: '1401',
    notes: 'Social Security cap: $176,100 for 2025. Medicare has no cap. Additional 0.9% Medicare above $200K/$250K MFJ.',
  },
  {
    ruleCode: 'SEC_199A_QBI',
    title: 'Qualified Business Income Deduction (Section 199A)',
    description: 'Deduct up to 20% of qualified business income from pass-through entities',
    taxYear: 2025,
    jurisdiction: 'federal',
    form: '1040',
    category: 'DEDUCTIONS_BUSINESS',
    subcategory: 'QBI',
    appliesTo: ['self_employed'],
    propertyTypes: ['business', 'rental'],
    filingStatuses: ['single', 'mfj', 'mfs', 'hoh'],
    percentageLimit: 0.20,
    ircSection: '199A',
    notes: '20% of QBI, limited by taxable income. Phase-out for specified service trades/businesses: $191,950-$241,950 single, $383,900-$483,900 MFJ (2025). Extended by OBBBA.',
    thresholds: [
      { filingStatus: 'single', bracketFloor: 191950, bracketCeiling: 241950, rate: 0.20 },
      { filingStatus: 'mfj', bracketFloor: 383900, bracketCeiling: 483900, rate: 0.20 },
    ],
  },
]

// ─── Deduction Category Mappings ──────────────────────────────────────────────

const DEDUCTION_MAPPINGS: DeductionMappingSeed[] = [
  // Schedule E — Rental
  {
    spendingCategory: 'Mortgage Interest', propertyType: 'rental',
    form: 'Schedule E', formLine: 'Line 12', scheduleECategory: 'Mortgage interest',
    allocationMethod: 'usage_split', defaultAllocationPct: 0.50,
    allocationNotes: 'Split by ownership percentage between personal and rental',
    requiresReceipt: false, taxYear: 2025,
  },
  {
    spendingCategory: 'Property Tax', propertyType: 'rental',
    form: 'Schedule E', formLine: 'Line 16', scheduleECategory: 'Taxes',
    allocationMethod: 'usage_split', defaultAllocationPct: 0.50,
    requiresReceipt: false, taxYear: 2025,
  },
  {
    spendingCategory: 'Insurance', propertyType: 'rental',
    form: 'Schedule E', formLine: 'Line 9', scheduleECategory: 'Insurance',
    allocationMethod: 'usage_split', defaultAllocationPct: 0.50,
    requiresReceipt: false, taxYear: 2025,
  },
  {
    spendingCategory: 'Repairs & Maintenance', propertyType: 'rental',
    form: 'Schedule E', formLine: 'Line 14', scheduleECategory: 'Repairs',
    allocationMethod: 'full', defaultAllocationPct: 1.0,
    allocationNotes: 'Repairs specific to a unit are 100% to that unit',
    requiresReceipt: true, taxYear: 2025,
  },
  {
    spendingCategory: 'Utilities', propertyType: 'rental',
    form: 'Schedule E', formLine: 'Line 17', scheduleECategory: 'Utilities',
    allocationMethod: 'usage_split', defaultAllocationPct: 0.50,
    requiresReceipt: false, taxYear: 2025,
  },
  {
    spendingCategory: 'Property Management', propertyType: 'rental',
    form: 'Schedule E', formLine: 'Line 19', scheduleECategory: 'Other',
    allocationMethod: 'full', defaultAllocationPct: 1.0,
    requiresReceipt: true, taxYear: 2025,
  },
  {
    spendingCategory: 'HOA Fees', propertyType: 'rental',
    form: 'Schedule E', formLine: 'Line 19', scheduleECategory: 'Other',
    allocationMethod: 'full', defaultAllocationPct: 1.0,
    requiresReceipt: false, taxYear: 2025,
  },
  // Schedule A — Personal residence
  {
    spendingCategory: 'Mortgage Interest', propertyType: 'personal',
    form: 'Schedule A', formLine: 'Line 8a',
    allocationMethod: 'usage_split', defaultAllocationPct: 0.50,
    allocationNotes: 'Personal portion of shared mortgage',
    requiresReceipt: false, taxYear: 2025,
  },
  {
    spendingCategory: 'Property Tax', propertyType: 'personal',
    form: 'Schedule A', formLine: 'Line 5b',
    allocationMethod: 'usage_split', defaultAllocationPct: 0.50,
    allocationNotes: 'Subject to SALT cap ($40K in 2025)',
    requiresReceipt: false, taxYear: 2025,
  },
  // Schedule C — Business
  {
    spendingCategory: 'Software', propertyType: 'business',
    form: 'Schedule C', formLine: 'Line 18',
    allocationMethod: 'full', defaultAllocationPct: 1.0,
    requiresReceipt: true, taxYear: 2025,
  },
  {
    spendingCategory: 'Hosting & Domains', propertyType: 'business',
    form: 'Schedule C', formLine: 'Line 18',
    allocationMethod: 'full', defaultAllocationPct: 1.0,
    requiresReceipt: true, taxYear: 2025,
  },
  {
    spendingCategory: 'Professional Services', propertyType: 'business',
    form: 'Schedule C', formLine: 'Line 17',
    allocationMethod: 'full', defaultAllocationPct: 1.0,
    requiresReceipt: true, taxYear: 2025,
  },
  {
    spendingCategory: 'Advertising & Marketing', propertyType: 'business',
    form: 'Schedule C', formLine: 'Line 8',
    allocationMethod: 'full', defaultAllocationPct: 1.0,
    requiresReceipt: true, taxYear: 2025,
  },
  {
    spendingCategory: 'Education & Training', propertyType: 'business',
    form: 'Schedule C', formLine: 'Line 27a',
    allocationMethod: 'full', defaultAllocationPct: 1.0,
    allocationNotes: 'Must maintain/improve skills for CURRENT business',
    requiresReceipt: true, taxYear: 2025,
  },
  {
    spendingCategory: 'Office Supplies', propertyType: 'business',
    form: 'Schedule C', formLine: 'Line 18',
    allocationMethod: 'full', defaultAllocationPct: 1.0,
    requiresReceipt: true, taxYear: 2025,
  },
]

// ─── Tax Calendar ─────────────────────────────────────────────────────────────

const TAX_CALENDAR_2025: TaxCalendarSeed[] = [
  {
    taxYear: 2025, eventName: 'Q1 Estimated Tax Payment Due',
    eventDate: '2025-04-15', eventType: 'deadline',
    appliesTo: ['self_employed', 'landlord'],
    actionRequired: 'Pay Q1 estimated federal tax via IRS Direct Pay or EFTPS',
  },
  {
    taxYear: 2025, eventName: 'Q2 Estimated Tax Payment Due',
    eventDate: '2025-06-16', eventType: 'deadline',
    appliesTo: ['self_employed', 'landlord'],
    actionRequired: 'Pay Q2 estimated federal tax',
  },
  {
    taxYear: 2025, eventName: 'Q3 Estimated Tax Payment Due',
    eventDate: '2025-09-15', eventType: 'deadline',
    appliesTo: ['self_employed', 'landlord'],
    actionRequired: 'Pay Q3 estimated federal tax',
  },
  {
    taxYear: 2025, eventName: 'Q4 Estimated Tax Payment Due',
    eventDate: '2026-01-15', eventType: 'deadline',
    appliesTo: ['self_employed', 'landlord'],
    actionRequired: 'Pay Q4 estimated federal tax for 2025',
  },
  {
    taxYear: 2025, eventName: 'Tax Filing Deadline',
    eventDate: '2026-04-15', eventType: 'deadline',
    appliesTo: ['all'],
    actionRequired: 'File 2025 federal income tax return (Form 1040) or extension (Form 4868)',
  },
  {
    taxYear: 2025, eventName: 'Extension Filing Deadline',
    eventDate: '2026-10-15', eventType: 'deadline',
    appliesTo: ['all'],
    actionRequired: 'File 2025 federal income tax return if extension was filed',
  },
]

const TAX_CALENDAR_2026: TaxCalendarSeed[] = [
  {
    taxYear: 2026, eventName: 'Q1 Estimated Tax Payment Due',
    eventDate: '2026-04-15', eventType: 'deadline',
    appliesTo: ['self_employed', 'landlord'],
    actionRequired: 'Pay Q1 estimated federal tax via IRS Direct Pay or EFTPS',
  },
  {
    taxYear: 2026, eventName: 'Q2 Estimated Tax Payment Due',
    eventDate: '2026-06-15', eventType: 'deadline',
    appliesTo: ['self_employed', 'landlord'],
    actionRequired: 'Pay Q2 estimated federal tax (June 15 is a Monday)',
  },
  {
    taxYear: 2026, eventName: 'Q3 Estimated Tax Payment Due',
    eventDate: '2026-09-15', eventType: 'deadline',
    appliesTo: ['self_employed', 'landlord'],
    actionRequired: 'Pay Q3 estimated federal tax',
  },
  {
    taxYear: 2026, eventName: 'Q4 Estimated Tax Payment Due',
    eventDate: '2027-01-15', eventType: 'deadline',
    appliesTo: ['self_employed', 'landlord'],
    actionRequired: 'Pay Q4 estimated federal tax for 2026',
  },
  {
    taxYear: 2026, eventName: 'Tax Filing Deadline',
    eventDate: '2027-04-15', eventType: 'deadline',
    appliesTo: ['all'],
    actionRequired: 'File 2026 federal income tax return (Form 1040) or extension',
  },
  {
    taxYear: 2026, eventName: 'Extension Filing Deadline',
    eventDate: '2027-10-15', eventType: 'deadline',
    appliesTo: ['all'],
    actionRequired: 'File 2026 federal income tax return if extension was filed',
  },
]

// ─── Combined data ────────────────────────────────────────────────────────────

const ALL_TAX_RULES: TaxRuleSeed[] = [
  BRACKETS_2025,
  BRACKETS_2026,
  STANDARD_DEDUCTION_2025,
  STANDARD_DEDUCTION_2026,
  SALT_2025,
  SALT_2026,
  MORTGAGE_INTEREST_2025,
  MORTGAGE_INTEREST_2026,
  CHILD_TAX_CREDIT_2025,
  CHILD_TAX_CREDIT_2026,
  ...SCHED_E_RENTAL_DEDUCTIONS,
  // Duplicate Schedule E rules for 2026 (same rules, same amounts)
  ...SCHED_E_RENTAL_DEDUCTIONS.map(r => ({ ...r, ruleCode: r.ruleCode + '_2026', taxYear: 2026 })),
  ...SCHED_C_BUSINESS_DEDUCTIONS,
  ...SCHED_C_BUSINESS_DEDUCTIONS.map(r => ({ ...r, ruleCode: r.ruleCode + '_2026', taxYear: 2026 })),
]

const ALL_CALENDARS: TaxCalendarSeed[] = [...TAX_CALENDAR_2025, ...TAX_CALENDAR_2026]

// Duplicate deduction mappings for 2026 (same rules apply)
const ALL_DEDUCTION_MAPPINGS: DeductionMappingSeed[] = [
  ...DEDUCTION_MAPPINGS,
  ...DEDUCTION_MAPPINGS.map(m => ({ ...m, taxYear: 2026 })),
]

// ─── Seeder Function ────────────────────────────────────────────────────────────

export async function seedTax2025_2026(db: PrismaClient): Promise<void> {
  console.log('  Seeding 2025-2026 tax rules (OBBBA)...')

  const lastVerified = new Date('2026-03-01')

  // ── Tax rules (upsert by ruleCode) ──────────────────────────────────
  for (const rule of ALL_TAX_RULES) {
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
        propertyTypes: rule.propertyTypes,
        filingStatuses: rule.filingStatuses,
        annualLimit: rule.annualLimit ?? null,
        incomePhaseOutStart: rule.incomePhaseOutStart ?? null,
        incomePhaseOutEnd: rule.incomePhaseOutEnd ?? null,
        percentageLimit: rule.percentageLimit ?? null,
        ircSection: rule.ircSection ?? null,
        notes: rule.notes ?? null,
        lastVerified,
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
        propertyTypes: rule.propertyTypes,
        filingStatuses: rule.filingStatuses,
        annualLimit: rule.annualLimit ?? null,
        incomePhaseOutStart: rule.incomePhaseOutStart ?? null,
        incomePhaseOutEnd: rule.incomePhaseOutEnd ?? null,
        percentageLimit: rule.percentageLimit ?? null,
        ircSection: rule.ircSection ?? null,
        notes: rule.notes ?? null,
        lastVerified,
      },
    })
  }
  console.log(`    ✓ ${ALL_TAX_RULES.length} tax rules upserted`)

  // ── Thresholds for rules that have them ─────────────────────────────
  let thresholdCount = 0
  for (const rule of ALL_TAX_RULES) {
    if (!rule.thresholds || rule.thresholds.length === 0) continue

    const dbRule = await db.taxRule.findUnique({
      where: { ruleCode: rule.ruleCode },
    })
    if (!dbRule) continue

    // Delete existing thresholds for this rule, then recreate
    await db.taxRuleThreshold.deleteMany({
      where: { taxRuleId: dbRule.id },
    })

    for (const t of rule.thresholds) {
      await db.taxRuleThreshold.create({
        data: {
          taxRuleId: dbRule.id,
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

  // ── Deduction category mappings ─────────────────────────────────────
  // Add new mappings that don't already exist (keyed by category+propertyType+taxYear)
  let mappingsAdded = 0
  for (const m of ALL_DEDUCTION_MAPPINGS) {
    const existing = await db.deductionCategoryMapping.findFirst({
      where: {
        spendingCategory: m.spendingCategory,
        propertyType: m.propertyType ?? null,
        taxYear: m.taxYear,
        form: m.form,
      },
    })
    if (!existing) {
      // Look up linked tax rule
      let taxRuleId: string | null = null
      if (m.form !== 'N/A' && m.formLine) {
        const rule = await db.taxRule.findFirst({
          where: { form: m.form, formLine: m.formLine, taxYear: m.taxYear },
        })
        taxRuleId = rule?.id ?? null
      }

      await db.deductionCategoryMapping.create({
        data: {
          spendingCategory: m.spendingCategory,
          propertyType: m.propertyType ?? null,
          taxRuleId,
          form: m.form,
          formLine: m.formLine ?? null,
          scheduleECategory: m.scheduleECategory ?? null,
          allocationMethod: m.allocationMethod ?? null,
          defaultAllocationPct: m.defaultAllocationPct ?? null,
          allocationNotes: m.allocationNotes ?? null,
          requiresReceipt: m.requiresReceipt,
          taxYear: m.taxYear,
        },
      })
      mappingsAdded++
    }
  }
  console.log(`    ✓ ${mappingsAdded} new deduction mappings added (${ALL_DEDUCTION_MAPPINGS.length - mappingsAdded} already existed)`)

  // ── Tax calendar ────────────────────────────────────────────────────
  // Replace calendar entries for 2025+2026+2027 with comprehensive data
  await db.taxCalendar.deleteMany({
    where: { taxYear: { in: [2025, 2026, 2027] } },
  })

  for (const entry of ALL_CALENDARS) {
    await db.taxCalendar.create({
      data: {
        taxYear: entry.taxYear,
        eventName: entry.eventName,
        eventDate: new Date(entry.eventDate),
        eventType: entry.eventType,
        description: entry.description ?? null,
        appliesTo: entry.appliesTo,
        actionRequired: entry.actionRequired ?? null,
      },
    })
  }
  console.log(`    ✓ ${ALL_CALENDARS.length} tax calendar entries created`)
}
