// ─── Enum aliases (mirror the Prisma schema) ─────────────────────────────────

export type CategoryType = 'income' | 'expense' | 'transfer'

export type AccountType = 'CHECKING' | 'SAVINGS' | 'CREDIT_CARD' | 'INVESTMENT' | 'CASH'

export type BudgetPeriod = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CUSTOM'

export type BudgetTier = 'FIXED' | 'FLEXIBLE' | 'ANNUAL'

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
  userId: string | null
}

export interface Transaction {
  id: string
  date: Date
  merchant: string
  amount: number
  transactionType: string | null
  originalStatement: string | null
  notes: string | null
  tags: string | null
  userId: string
  accountId: string | null
  account?: Account | null
  categoryId: string | null
  category?: Category | null
  createdAt: Date
  updatedAt: Date
}

export interface Budget {
  id: string
  name: string
  amount: number
  spent: number
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

// ─── API response shapes ──────────────────────────────────────────────────────

export interface ApiError {
  error: string
  details?: string
}
