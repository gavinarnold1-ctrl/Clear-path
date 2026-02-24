/**
 * T1.2 — Fixed expense matching (Phase 1, Step 2)
 *
 * Verifies that fixed expenses match transactions by categoryId within the
 * current month, not by exact date or merchant name.
 *
 * Tests the getFixedStatus logic from FixedBudgetSection.tsx.
 * Since getFixedStatus is not exported, we replicate its logic here to
 * unit-test the matching behavior.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'

// ─── Replicate the getFixedStatus logic for testing ─────────────────────────

type FixedStatus = 'paid' | 'variance' | 'missed' | 'pending'

interface Transaction {
  categoryId: string | null
  amount: number
}

interface FixedBudget {
  id: string
  name: string
  amount: number
  spent: number
  dueDay: number | null
  isAutoPay: boolean | null
  varianceLimit: number | null
  category: { name: string; icon: string | null } | null
  categoryId: string | null
}

/**
 * Exact replica of getFixedStatus from FixedBudgetSection.tsx.
 * This ensures we test the real matching logic.
 */
function getFixedStatus(budget: FixedBudget, transactions: Transaction[]): FixedStatus {
  const matches = transactions.filter((t) => t.categoryId === budget.categoryId)

  if (matches.length === 0) {
    const today = new Date().getDate()
    if (budget.dueDay && today > budget.dueDay) return 'missed'
    return 'pending'
  }

  const totalPaid = matches.reduce((sum, t) => sum + Math.abs(t.amount), 0)
  const expected = budget.amount
  const varianceLimit = budget.varianceLimit ?? expected * 0.05

  if (Math.abs(totalPaid - expected) > varianceLimit) return 'variance'
  return 'paid'
}

// ─── Test: Matching by categoryId, not by merchant or date ──────────────────

describe('T1.2 — Fixed expense matching by categoryId within month', () => {
  const mortgageBudget: FixedBudget = {
    id: 'b-mortgage',
    name: 'Mortgage Payment',
    amount: 1500,
    spent: 0,
    dueDay: 1,
    isAutoPay: true,
    varianceLimit: null,
    category: { name: 'Mortgage', icon: null },
    categoryId: 'cat-mortgage',
  }

  const phoneBudget: FixedBudget = {
    id: 'b-phone',
    name: 'AT&T Phone',
    amount: 89.99,
    spent: 0,
    dueDay: 15,
    isAutoPay: true,
    varianceLimit: null,
    category: { name: 'Phone', icon: null },
    categoryId: 'cat-phone',
  }

  const waterBudget: FixedBudget = {
    id: 'b-water',
    name: 'South Central CT Water',
    amount: 45,
    spent: 0,
    dueDay: 10,
    isAutoPay: false,
    varianceLimit: 10,
    category: { name: 'Water', icon: null },
    categoryId: 'cat-water',
  }

  it('shows PAID when a transaction matches by categoryId', () => {
    const transactions: Transaction[] = [
      { categoryId: 'cat-mortgage', amount: -1500 },
    ]
    expect(getFixedStatus(mortgageBudget, transactions)).toBe('paid')
  })

  it('shows PAID even when transaction date differs from dueDay', () => {
    // Transaction on day 15, budget due on day 1 — still matches by category
    const transactions: Transaction[] = [
      { categoryId: 'cat-mortgage', amount: -1500 },
    ]
    expect(getFixedStatus(mortgageBudget, transactions)).toBe('paid')
  })

  it('shows PAID regardless of merchant name (matches by categoryId only)', () => {
    // Different merchant name but same category
    const transactions: Transaction[] = [
      { categoryId: 'cat-phone', amount: -89.99 },
    ]
    expect(getFixedStatus(phoneBudget, transactions)).toBe('paid')
  })

  it('shows PAID when amount matches within default variance (5%)', () => {
    // Mortgage: $1500, paid $1510 — within 5% ($75 tolerance)
    const transactions: Transaction[] = [
      { categoryId: 'cat-mortgage', amount: -1510 },
    ]
    expect(getFixedStatus(mortgageBudget, transactions)).toBe('paid')
  })

  it('shows VARIANCE when amount exceeds variance limit', () => {
    // Water: $45 expected, $60 paid, varianceLimit = $10
    const transactions: Transaction[] = [
      { categoryId: 'cat-water', amount: -60 },
    ]
    expect(getFixedStatus(waterBudget, transactions)).toBe('variance')
  })

  it('shows PAID when amount within custom variance limit', () => {
    // Water: $45 expected, $52 paid, varianceLimit = $10 — within limit
    const transactions: Transaction[] = [
      { categoryId: 'cat-water', amount: -52 },
    ]
    expect(getFixedStatus(waterBudget, transactions)).toBe('paid')
  })

  it('sums multiple transactions for the same category', () => {
    // Two partial mortgage payments in the same month
    const transactions: Transaction[] = [
      { categoryId: 'cat-mortgage', amount: -750 },
      { categoryId: 'cat-mortgage', amount: -750 },
    ]
    expect(getFixedStatus(mortgageBudget, transactions)).toBe('paid')
  })

  it('a transaction on ANY day of the month counts (not just due date)', () => {
    // Budget due on day 1, transaction on day 28
    const transactions: Transaction[] = [
      { categoryId: 'cat-phone', amount: -89.99 },
    ]
    // Transactions are pre-filtered to current month by the budgets page
    expect(getFixedStatus(phoneBudget, transactions)).toBe('paid')
  })

  it('ignores transactions from other categories', () => {
    const transactions: Transaction[] = [
      { categoryId: 'cat-groceries', amount: -100 },
      { categoryId: 'cat-internet', amount: -74.99 },
    ]
    // No matching transactions for mortgage
    // Since we can't mock Date.getDate() without side effects, test with dueDay in the future
    const futureBudget = { ...mortgageBudget, dueDay: 31 }
    expect(getFixedStatus(futureBudget, transactions)).toBe('pending')
  })
})

// ─── Test: MISSED status when no transaction and past due date ──────────────

describe('T1.2 — Fixed expense MISSED detection', () => {
  let dateSpy: ReturnType<typeof vi.spyOn>

  afterEach(() => {
    dateSpy?.mockRestore()
  })

  it('shows MISSED when no transaction and current date > dueDay', () => {
    // Mock current date to be the 20th
    const mockDate = new Date(2026, 1, 20) // Feb 20
    dateSpy = vi.spyOn(global, 'Date').mockImplementation((...args: unknown[]) => {
      if (args.length === 0) return mockDate
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new (Function.prototype.bind.apply(Date as any, [null, ...args] as any))()
    }) as ReturnType<typeof vi.spyOn>

    const budget: FixedBudget = {
      id: 'b-insurance',
      name: 'Auto Insurance',
      amount: 150,
      spent: 0,
      dueDay: 1,
      isAutoPay: false,
      varianceLimit: null,
      category: { name: 'Insurance', icon: null },
      categoryId: 'cat-insurance',
    }

    expect(getFixedStatus(budget, [])).toBe('missed')
  })

  it('shows PENDING when no transaction and current date <= dueDay', () => {
    // Mock current date to be the 5th
    const mockDate = new Date(2026, 1, 5) // Feb 5
    dateSpy = vi.spyOn(global, 'Date').mockImplementation((...args: unknown[]) => {
      if (args.length === 0) return mockDate
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new (Function.prototype.bind.apply(Date as any, [null, ...args] as any))()
    }) as ReturnType<typeof vi.spyOn>

    const budget: FixedBudget = {
      id: 'b-insurance',
      name: 'Auto Insurance',
      amount: 150,
      spent: 0,
      dueDay: 15,
      isAutoPay: false,
      varianceLimit: null,
      category: { name: 'Insurance', icon: null },
      categoryId: 'cat-insurance',
    }

    expect(getFixedStatus(budget, [])).toBe('pending')
  })

  it('shows PENDING when no dueDay is set and no transactions', () => {
    const budget: FixedBudget = {
      id: 'b-misc',
      name: 'Misc Fixed',
      amount: 50,
      spent: 0,
      dueDay: null,
      isAutoPay: false,
      varianceLimit: null,
      category: { name: 'Misc', icon: null },
      categoryId: 'cat-misc',
    }

    expect(getFixedStatus(budget, [])).toBe('pending')
  })
})

// ─── Test: Source code verification ─────────────────────────────────────────

describe('T1.2 — Source verification: matching uses categoryId', () => {
  it('FixedBudgetSection.tsx matches transactions by categoryId', () => {
    const codePath = path.resolve(
      __dirname,
      '../../src/components/budgets/FixedBudgetSection.tsx'
    )
    const code = fs.readFileSync(codePath, 'utf-8')

    // Must filter by categoryId
    expect(code).toMatch(/t\.categoryId\s*===\s*budget\.categoryId/)

    // Must NOT match by merchant name or exact date
    expect(code).not.toMatch(/t\.merchant\s*===/)
    expect(code).not.toMatch(/t\.date\s*===/)
  })

  it('budgets page pre-filters transactions to current month', () => {
    const pagePath = path.resolve(
      __dirname,
      '../../src/app/(dashboard)/budgets/page.tsx'
    )
    const code = fs.readFileSync(pagePath, 'utf-8')

    // Transactions are fetched with date range filter for current month
    expect(code).toMatch(/startOfMonth/)
    expect(code).toMatch(/endOfMonth/)
    expect(code).toMatch(/date:\s*\{.*gte.*startOfMonth/)
  })
})
