import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks ---

const mockBudgetCreate = vi.fn()
const mockBudgetDelete = vi.fn()
const mockBudgetFindFirst = vi.fn()
const mockBudgetUpdate = vi.fn()
const mockAnnualExpenseCreate = vi.fn()
const mockAnnualExpenseUpdate = vi.fn()

const mockPrismaTx = {
  budget: { create: mockBudgetCreate, update: mockBudgetUpdate },
  annualExpense: { create: mockAnnualExpenseCreate, update: mockAnnualExpenseUpdate },
}

vi.mock('@/lib/db', () => ({
  db: {
    budget: {
      create: (...args: unknown[]) => mockBudgetCreate(...args),
      delete: (...args: unknown[]) => mockBudgetDelete(...args),
      findFirst: (...args: unknown[]) => mockBudgetFindFirst(...args),
      update: (...args: unknown[]) => mockBudgetUpdate(...args),
    },
    annualExpense: {
      update: (...args: unknown[]) => mockAnnualExpenseUpdate(...args),
    },
    $transaction: vi.fn((fnOrArray: unknown) => {
      if (typeof fnOrArray === 'function') {
        return (fnOrArray as (tx: typeof mockPrismaTx) => Promise<unknown>)(mockPrismaTx)
      }
      return Promise.all(fnOrArray as Promise<unknown>[])
    }),
  },
}))

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { createBudget, deleteBudget, fundAnnualExpense } from '@/app/actions/budgets'
import { getSession } from '@/lib/session'

const mockGetSession = getSession as ReturnType<typeof vi.fn>

function fd(data: Record<string, string>): FormData {
  const f = new FormData()
  Object.entries(data).forEach(([k, v]) => f.append(k, v))
  return f
}

// ─── createBudget ─────────────────────────────────────────────────────────

describe('createBudget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ userId: 'u1', email: 'a@b.com', name: null })
  })

  it('redirects to /login when no session', async () => {
    mockGetSession.mockResolvedValue(null)
    await expect(createBudget({ error: null }, fd({ name: 'Test' }))).rejects.toThrow('NEXT_REDIRECT:/login')
  })

  it('returns error when name is empty', async () => {
    const result = await createBudget({ error: null }, fd({ name: '', tier: 'FLEXIBLE', amount: '100', startDate: '2026-02-01' }))
    expect(result.error).toContain('name is required')
  })

  it('returns error for invalid tier', async () => {
    const result = await createBudget({ error: null }, fd({ name: 'Test', tier: 'INVALID', startDate: '2026-02-01' }))
    expect(result.error).toContain('Invalid budget tier')
  })

  it('creates a FIXED budget with tier-specific fields', async () => {
    await expect(
      createBudget({ error: null }, fd({
        name: 'Mortgage',
        amount: '1500',
        tier: 'FIXED',
        categoryId: '',
        startDate: '2026-02-01',
        dueDay: '1',
        isAutoPay: 'true',
        varianceLimit: '10',
      }))
    ).rejects.toThrow('NEXT_REDIRECT:/budgets')

    expect(mockBudgetCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tier: 'FIXED',
          period: 'MONTHLY',
          isAutoPay: true,
          dueDay: 1,
          varianceLimit: 10,
          amount: 1500,
        }),
      })
    )
  })

  it('creates a FLEXIBLE budget with period', async () => {
    await expect(
      createBudget({ error: null }, fd({
        name: 'Groceries',
        amount: '500',
        tier: 'FLEXIBLE',
        period: 'MONTHLY',
        categoryId: '',
        startDate: '2026-02-01',
      }))
    ).rejects.toThrow('NEXT_REDIRECT:/budgets')

    expect(mockBudgetCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tier: 'FLEXIBLE',
          period: 'MONTHLY',
          amount: 500,
        }),
      })
    )
  })

  it('creates an ANNUAL budget with annualExpense record', async () => {
    mockBudgetCreate.mockResolvedValue({ id: 'budget-1' })

    await expect(
      createBudget({ error: null }, fd({
        name: 'Summer Vacation',
        tier: 'ANNUAL',
        annualAmount: '2400',
        dueMonth: '6',
        dueYear: '2027',
        isRecurring: 'false',
        funded: '0',
        startDate: '2026-02-01',
      }))
    ).rejects.toThrow('NEXT_REDIRECT:/budgets')

    expect(mockBudgetCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tier: 'ANNUAL',
          period: 'MONTHLY',
        }),
      })
    )
    expect(mockAnnualExpenseCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          budgetId: 'budget-1',
          annualAmount: 2400,
          dueMonth: 6,
          dueYear: 2027,
        }),
      })
    )
  })

  it('returns error for ANNUAL with invalid due month', async () => {
    const result = await createBudget({ error: null }, fd({
      name: 'Test',
      tier: 'ANNUAL',
      annualAmount: '1200',
      dueMonth: '13',
      dueYear: '2027',
      startDate: '2026-02-01',
    }))
    expect(result.error).toContain('Due month')
  })

  it('returns error for FIXED with zero amount', async () => {
    const result = await createBudget({ error: null }, fd({
      name: 'Test',
      tier: 'FIXED',
      amount: '0',
      startDate: '2026-02-01',
    }))
    expect(result.error).toContain('positive number')
  })
})

// ─── fundAnnualExpense ────────────────────────────────────────────────────

describe('fundAnnualExpense', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ userId: 'u1', email: 'a@b.com', name: null })
  })

  it('redirects to /login when no session', async () => {
    mockGetSession.mockResolvedValue(null)
    await expect(fundAnnualExpense('b1', 100)).rejects.toThrow('NEXT_REDIRECT:/login')
  })

  it('returns error for non-positive amount', async () => {
    const result = await fundAnnualExpense('b1', 0)
    expect(result.error).toContain('positive')
  })

  it('returns error when budget not found', async () => {
    mockBudgetFindFirst.mockResolvedValue(null)
    const result = await fundAnnualExpense('b1', 100)
    expect(result.error).toContain('not found')
  })

  it('updates funded amount and recalculates set-aside', async () => {
    mockBudgetFindFirst.mockResolvedValue({
      id: 'b1',
      annualExpense: {
        id: 'ae1',
        annualAmount: 1200,
        funded: 200,
        dueMonth: 12,
        dueYear: 2026,
        monthlySetAside: 100,
      },
    })

    const result = await fundAnnualExpense('b1', 100)
    expect(result.error).toBeNull()
    expect(mockAnnualExpenseUpdate).toHaveBeenCalled()
    expect(mockBudgetUpdate).toHaveBeenCalled()
  })
})

// ─── deleteBudget ─────────────────────────────────────────────────────────

describe('deleteBudget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ userId: 'u1', email: 'a@b.com', name: null })
  })

  it('redirects to /login when no session', async () => {
    mockGetSession.mockResolvedValue(null)
    await expect(deleteBudget('b1')).rejects.toThrow('NEXT_REDIRECT:/login')
  })

  it('deletes the budget by id and userId', async () => {
    await deleteBudget('b1')
    expect(mockBudgetDelete).toHaveBeenCalledWith({
      where: { id: 'b1', userId: 'u1' },
    })
  })
})
