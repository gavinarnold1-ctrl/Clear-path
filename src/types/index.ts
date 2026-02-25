// ─── Enum aliases (mirror the Prisma schema) ─────────────────────────────────

export type CategoryType = 'income' | 'expense' | 'transfer'

export type AccountType =
  | 'CHECKING'
  | 'SAVINGS'
  | 'CREDIT_CARD'
  | 'INVESTMENT'
  | 'CASH'
  | 'MORTGAGE'
  | 'AUTO_LOAN'
  | 'STUDENT_LOAN'

export type BudgetPeriod = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CUSTOM'

export type BudgetTier = 'FIXED' | 'FLEXIBLE' | 'ANNUAL'

export type PropertyType = 'PERSONAL' | 'RENTAL'

export type DebtType =
  | 'MORTGAGE'
  | 'STUDENT_LOAN'
  | 'AUTO'
  | 'CREDIT_CARD'
  | 'PERSONAL_LOAN'
  | 'OTHER'

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  name: string | null
  createdAt: Date
}

export interface Account {
  id: string
  name: string
  type: AccountType
  balance: number
  currency: string
  institution: string | null
  isManual: boolean
  userId: string
}

export interface Category {
  id: string
  type: CategoryType
  group: string
  name: string
  icon: string | null
  budgetTier: BudgetTier | null
  isDefault: boolean
  isActive: boolean
  isTaxRelevant: boolean
  scheduleECategory: string | null
  userId: string | null
}

export interface HouseholdMember {
  id: string
  userId: string
  name: string
  isDefault: boolean
  createdAt: Date
}

export interface Property {
  id: string
  userId: string
  name: string
  type: PropertyType
  isDefault: boolean
  createdAt: Date
}

export type Classification = 'income' | 'expense' | 'transfer'

export interface Transaction {
  id: string
  date: Date
  merchant: string
  amount: number
  classification: Classification
  transactionType: string | null
  originalStatement: string | null
  originalCategory: string | null
  notes: string | null
  tags: string | null
  importSource: string | null
  userId: string
  accountId: string | null
  account?: Account | null
  categoryId: string | null
  category?: Category | null
  householdMemberId: string | null
  householdMember?: HouseholdMember | null
  propertyId: string | null
  property?: Property | null
  createdAt: Date
  updatedAt: Date
}

export interface Budget {
  id: string
  name: string
  amount: number
  period: BudgetPeriod
  tier: BudgetTier
  startDate: Date
  endDate: Date | null
  isAutoPay: boolean | null
  dueDay: number | null
  varianceLimit: number | null
  userId: string
  categoryId: string | null
  category?: Category | null
  annualExpense?: AnnualExpense | null
  createdAt: Date
  updatedAt: Date
}

export interface AnnualExpense {
  id: string
  budgetId: string
  name: string
  annualAmount: number
  dueMonth: number
  dueYear: number
  isRecurring: boolean
  monthlySetAside: number
  funded: number
  status: string
  actualCost: number | null
  actualDate: Date | null
  notes: string | null
  userId: string
}

export interface Debt {
  id: string
  userId: string
  name: string
  type: DebtType
  currentBalance: number
  originalBalance: number | null
  interestRate: number
  minimumPayment: number
  paymentDay: number | null
  termMonths: number | null
  startDate: Date | null
  propertyId: string | null
  property?: Property | null
  categoryId: string | null
  category?: Category | null
  createdAt: Date
  updatedAt: Date
}

// ─── Onboarding types ────────────────────────────────────────────────────────

export type PrimaryGoal = 'debt_payoff' | 'emergency_savings' | 'major_purchase' | 'invest' | 'organize'

export type HouseholdType = 'single' | 'shared_partner' | 'separate_partner' | 'family'

export type DebtLevel = 'minimal' | 'credit_cards' | 'student_loans' | 'multiple'

export type CategoryMode = 'recommended' | 'custom' | 'import_match'

export interface OnboardingAccountEntry {
  name: string
  type: AccountType
}

export interface OnboardingPropertyEntry {
  name: string
}

export interface OnboardingPendingSetup {
  partnerName?: string
  accounts: OnboardingAccountEntry[]
  properties: OnboardingPropertyEntry[]
}

export interface OnboardingAnswers {
  primaryGoal: PrimaryGoal | null
  householdType: HouseholdType | null
  partnerName: string | null
  accounts: OnboardingAccountEntry[]
  hasRentalProperty: boolean
  rentalCount: number
  properties: OnboardingPropertyEntry[]
  debtLevel: DebtLevel | null
  categoryMode: CategoryMode | null
}

// ─── API response shapes ──────────────────────────────────────────────────────

export interface ApiError {
  error: string
  details?: string
}
