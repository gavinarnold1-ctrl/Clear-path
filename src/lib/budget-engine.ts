import type { BudgetTier } from '@/types'

// ─── Month helpers ───────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function formatMonthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? `Month ${month}`
}

export function formatOrdinalDay(day: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = day % 100
  return `${day}${s[(v - 20) % 10] || s[v] || s[0]}`
}

// ─── Annual planning calculations ───────────────────────────────────────────

export function monthsUntilDue(
  dueMonth: number,
  dueYear: number,
  now: Date = new Date()
): number {
  const currentMonth = now.getMonth() + 1 // 1-indexed
  const currentYear = now.getFullYear()

  const totalMonthsCurrent = currentYear * 12 + currentMonth
  const totalMonthsDue = dueYear * 12 + dueMonth

  const diff = totalMonthsDue - totalMonthsCurrent
  return Math.max(diff, 0)
}

export function calculateMonthlySetAside(
  annualAmount: number,
  funded: number,
  dueMonth: number,
  dueYear: number,
  now: Date = new Date()
): number {
  const remaining = annualAmount - funded
  if (remaining <= 0) return 0

  const months = monthsUntilDue(dueMonth, dueYear, now)
  if (months <= 0) return remaining // Due now or past due — need it all

  return Math.ceil((remaining / months) * 100) / 100 // Round up to nearest cent
}

// ─── Fixed bill variance ────────────────────────────────────────────────────

export function isWithinVariance(
  expected: number,
  actual: number,
  varianceLimit: number | null
): boolean {
  if (varianceLimit === null || varianceLimit === undefined) return true
  return Math.abs(actual - expected) <= varianceLimit
}

// ─── Tier summary aggregation ───────────────────────────────────────────────

interface BudgetForSummary {
  tier: BudgetTier
  amount: number
  spent: number
  annualExpense?: {
    monthlySetAside: number
    annualAmount: number
    funded: number
  } | null
}

export interface TierSummary {
  fixed: { total: number; paidCount: number; totalCount: number }
  flexible: { budgeted: number; spent: number; remaining: number }
  annual: { monthlySetAside: number; totalAnnual: number; totalFunded: number }
  totalMonthlyObligation: number
}

export function calculateTierSummary(budgets: BudgetForSummary[]): TierSummary {
  const fixed = { total: 0, paidCount: 0, totalCount: 0 }
  const flexible = { budgeted: 0, spent: 0, remaining: 0 }
  const annual = { monthlySetAside: 0, totalAnnual: 0, totalFunded: 0 }

  for (const b of budgets) {
    switch (b.tier) {
      case 'FIXED':
        fixed.total += b.amount
        fixed.totalCount += 1
        if (b.spent > 0) fixed.paidCount += 1
        break
      case 'FLEXIBLE':
        flexible.budgeted += b.amount
        flexible.spent += b.spent
        break
      case 'ANNUAL':
        if (b.annualExpense) {
          annual.monthlySetAside += b.annualExpense.monthlySetAside
          annual.totalAnnual += b.annualExpense.annualAmount
          annual.totalFunded += b.annualExpense.funded
        }
        break
    }
  }

  flexible.remaining = flexible.budgeted - flexible.spent

  return {
    fixed,
    flexible,
    annual,
    totalMonthlyObligation: fixed.total + flexible.budgeted + annual.monthlySetAside,
  }
}

// ─── Tier label helpers ─────────────────────────────────────────────────────

export function tierLabel(tier: BudgetTier): string {
  switch (tier) {
    case 'FIXED': return 'Fixed'
    case 'FLEXIBLE': return 'Flexible'
    case 'ANNUAL': return 'Annual'
    default: return tier
  }
}

export function tierDescription(tier: BudgetTier): string {
  switch (tier) {
    case 'FIXED': return 'Predictable recurring expenses that stay the same each month'
    case 'FLEXIBLE': return 'Variable spending you control — track against a monthly limit'
    case 'ANNUAL': return 'Irregular expenses you plan and save for over time'
    default: return ''
  }
}
