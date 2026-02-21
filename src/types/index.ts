// ─── Enum aliases (mirror the Prisma schema) ─────────────────────────────────

export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER'

export type AccountType = 'CHECKING' | 'SAVINGS' | 'CREDIT_CARD' | 'INVESTMENT' | 'CASH'

export type BudgetPeriod = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CUSTOM'

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
  name: string
  color: string
  icon: string | null
  type: TransactionType
  userId: string
}

export interface Transaction {
  id: string
  amount: number
  description: string
  date: Date
  type: TransactionType
  notes: string | null
  userId: string
  accountId: string
  account?: Account
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
  startDate: Date
  endDate: Date | null
  userId: string
  categoryId: string | null
  category?: Category | null
  createdAt: Date
  updatedAt: Date
}

// ─── API response shapes ──────────────────────────────────────────────────────

export interface ApiError {
  error: string
  details?: string
}
