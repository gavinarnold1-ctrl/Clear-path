/**
 * Zod validation schemas for API input validation (R11.12).
 * Used across API routes and server actions to validate user input.
 */
import { z } from 'zod'

// ── Shared Primitives ──────────────────────────────────────────────────────

/** Transaction amounts: finite, reasonable range. */
export const amountSchema = z.number().finite().min(-10_000_000).max(10_000_000)

/** Safe string: trimmed, max length. */
export const safeString = (maxLength = 500) =>
  z.string().max(maxLength).transform((s) => s.trim())

/** Date string in ISO format. */
export const dateString = z.string().refine(
  (s) => !isNaN(Date.parse(s)),
  { message: 'Invalid date format' }
)

/** CUID-like ID. */
export const idString = z.string().min(1).max(50)

// ── Account Schemas ────────────────────────────────────────────────────────

export const accountTypes = [
  'CHECKING', 'SAVINGS', 'CREDIT_CARD', 'INVESTMENT', 'CASH',
  'MORTGAGE', 'AUTO_LOAN', 'STUDENT_LOAN',
] as const

export const createAccountSchema = z.object({
  name: safeString(100),
  type: z.enum(accountTypes),
  balance: z.number().finite().optional(),
  currency: safeString(10).optional(),
  ownerId: idString.optional().nullable(),
  balanceAsOfDate: dateString.optional().nullable(),
})

export const updateAccountSchema = z.object({
  name: safeString(100).optional(),
  type: z.enum(accountTypes).optional(),
  balance: z.union([z.number().finite(), z.string().transform(Number)]).optional(),
  institution: safeString(200).optional().nullable(),
  ownerId: idString.optional().nullable(),
  startingBalance: z.union([z.number().finite(), z.string().transform(Number)]).optional(),
  balanceAsOfDate: dateString.optional().nullable(),
})

// ── Transaction Schemas ────────────────────────────────────────────────────

export const createTransactionSchema = z.object({
  amount: amountSchema,
  merchant: safeString(200),
  date: dateString,
  accountId: idString.optional().nullable(),
  categoryId: idString.optional().nullable(),
  householdMemberId: idString.optional().nullable(),
  propertyId: idString.optional().nullable(),
  notes: safeString(1000).optional().nullable(),
  tags: safeString(500).optional().nullable(),
  originalStatement: safeString(500).optional().nullable(),
  transactionType: z.enum(['debit', 'credit']).optional().nullable(),
  importSource: safeString(50).optional().nullable(),
})

export const updateTransactionSchema = createTransactionSchema.partial()

// ── Budget Schemas ─────────────────────────────────────────────────────────

export const budgetPeriods = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM'] as const
export const budgetTiers = ['FIXED', 'FLEXIBLE', 'ANNUAL'] as const

export const createBudgetSchema = z.object({
  categoryId: idString,
  amount: amountSchema,
  period: z.enum(budgetPeriods).optional(),
  tier: z.enum(budgetTiers).optional(),
  isAutoPay: z.boolean().optional(),
  dueDay: z.number().int().min(1).max(31).optional().nullable(),
  varianceLimit: z.number().finite().min(0).optional().nullable(),
})

// ── Category Schemas ───────────────────────────────────────────────────────

export const createCategorySchema = z.object({
  name: safeString(100),
  type: z.enum(['income', 'expense', 'transfer', 'perk_reimbursement']),
  group: safeString(100).optional().nullable(),
  budgetTier: z.enum(budgetTiers).optional().nullable(),
})

// ── Debt Schemas ───────────────────────────────────────────────────────────

export const debtTypes = [
  'MORTGAGE', 'STUDENT_LOAN', 'AUTO', 'CREDIT_CARD', 'PERSONAL_LOAN', 'OTHER',
] as const

export const createDebtSchema = z.object({
  name: safeString(200),
  type: z.enum(debtTypes),
  currentBalance: amountSchema,
  originalBalance: amountSchema.optional(),
  interestRate: z.number().finite().min(0).max(100),
  minimumPayment: amountSchema.optional(),
  propertyId: idString.optional().nullable(),
  categoryId: idString.optional().nullable(),
})

// ── CSV Import Schemas ─────────────────────────────────────────────────────

/** Max CSV file size: 10MB */
export const MAX_CSV_SIZE = 10 * 1024 * 1024

export const csvImportPreviewSchema = z.object({
  content: z.string().max(MAX_CSV_SIZE),
})

// ── Profile Schemas ────────────────────────────────────────────────────────

export const updateProfileSchema = z.object({
  name: safeString(100).optional().nullable(),
  email: z.string().email().max(254).optional(),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8).max(200),
})

// ── Household Member Schemas ───────────────────────────────────────────────

export const createMemberSchema = z.object({
  name: safeString(100),
  isDefault: z.boolean().optional(),
})

// ── Property Schemas ───────────────────────────────────────────────────────

export const propertyTypes = ['PERSONAL', 'RENTAL'] as const

export const createPropertySchema = z.object({
  name: safeString(100),
  type: z.enum(propertyTypes),
  isDefault: z.boolean().optional(),
})

// ── Helper ─────────────────────────────────────────────────────────────────

/**
 * Parse and validate request body with a Zod schema.
 * Returns { success: true, data } or { success: false, error }.
 */
export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown):
  { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(body)
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    return { success: false, error: `Validation failed: ${issues}` }
  }
  return { success: true, data: result.data }
}
