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

export type PropertyType = 'PERSONAL' | 'RENTAL' | 'BUSINESS'

export type TransactionClassification = 'expense' | 'income' | 'transfer'

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
  startingBalance: number
  balanceAsOfDate: Date | null
  currency: string
  institution: string | null
  isManual: boolean
  plaidAccountId: string | null
  plaidItemId: string | null
  plaidLastSynced: Date | null
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
  address?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
  taxSchedule?: string | null
  purchasePrice?: number | null
  purchaseDate?: Date | null
  buildingValuePct?: number | null
  priorDepreciation?: number | null
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
  escrowAmount: number | null
  paymentDay: number | null
  termMonths: number | null
  startDate: Date | null
  propertyId: string | null
  property?: Property | null
  categoryId: string | null
  category?: Category | null
  accountId: string | null
  account?: Account | null
  createdAt: Date
  updatedAt: Date
}

// ─── Onboarding types ────────────────────────────────────────────────────────

export type PrimaryGoal = 'save_more' | 'spend_smarter' | 'pay_off_debt' | 'gain_visibility' | 'build_wealth'

export type IncomeRange = 'under_50k' | '50k_100k' | '100k_150k' | '150k_200k' | '200k_300k' | 'over_300k'

export type HouseholdType = 'single' | 'shared_partner' | 'separate_partner' | 'family'

export type DebtLevel = 'minimal' | 'credit_cards' | 'student_loans' | 'multiple'

export type CategoryMode = 'recommended' | 'custom' | 'import_match'

export interface OnboardingPendingSetup {
  partnerName?: string
}

export interface OnboardingAnswers {
  primaryGoal: PrimaryGoal | null
  householdType: HouseholdType | null
  partnerName: string | null
  incomeRange: IncomeRange | null
}

// ─── API response shapes ──────────────────────────────────────────────────────

export interface ApiError {
  error: string
  details?: string
}
