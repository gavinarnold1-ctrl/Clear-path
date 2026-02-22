// ─── Enum aliases (mirror the Prisma schema) ─────────────────────────────────

export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER'

export type AccountType = 'CHECKING' | 'SAVINGS' | 'CREDIT_CARD' | 'INVESTMENT' | 'CASH'

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
  group: string
  budgetTier: string | null
  isDefault: boolean
  isActive: boolean
  userId: string | null
}

export interface Transaction {
  id: string
  amount: number
  merchant: string
  originalStatement: string | null
  tags: string | null
  date: Date
  notes: string | null
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
  tier: string
  startDate: Date
  endDate: Date | null
  userId: string
  categoryId: string | null
  category?: Category | null
  createdAt: Date
  updatedAt: Date
}

export interface AnnualExpense {
  id: string
  name: string
  amount: number
  dueDate: Date
  notes: string | null
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
