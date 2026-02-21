import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks ---

const mockTxCreate = vi.fn()
const mockAccountUpdate = vi.fn()
const mockBudgetFindFirst = vi.fn()
const mockBudgetUpdate = vi.fn()
const mockTxFindUnique = vi.fn()
const mockTxDelete = vi.fn()

const mockPrismaTx = {
  transaction: { create: mockTxCreate, findUnique: mockTxFindUnique, delete: mockTxDelete },
  account: { update: mockAccountUpdate },
  budget: { findFirst: mockBudgetFindFirst, update: mockBudgetUpdate },
}

vi.mock('@/lib/db', () => ({
  db: {
    $transaction: vi.fn((fn: (tx: typeof mockPrismaTx) => Promise<unknown>) => fn(mockPrismaTx)),
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

import { createTransaction, deleteTransaction } from '@/app/actions/transactions'
import { getSession } from '@/lib/session'

const mockGetSession = getSession as ReturnType<typeof vi.fn>

function fd(data: Record<string, string>): FormData {
  const f = new FormData()
  Object.entries(data).forEach(([k, v]) => f.append(k, v))
  return f
}

const validData = {
  amount: '100',
  description: 'Test expense',
  date: '2026-02-01',
  type: 'EXPENSE',
  accountId: 'acc-1',
  categoryId: '',
  notes: '',
}

// ─── createTransaction ────────────────────────────────────────────────────

describe('createTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ userId: 'u1', email: 'a@b.com', name: null })
    mockBudgetFindFirst.mockResolvedValue(null)
  })

  it('redirects to /login when no session', async () => {
    mockGetSession.mockResolvedValue(null)
    await expect(createTransaction({ error: null }, fd(validData))).rejects.toThrow('NEXT_REDIRECT:/login')
  })

  it('returns error for amount <= 0', async () => {
    const result = await createTransaction({ error: null }, fd({ ...validData, amount: '0' }))
    expect(result.error).toContain('positive')
  })

  it('returns error for negative amount', async () => {
    const result = await createTransaction({ error: null }, fd({ ...validData, amount: '-50' }))
    expect(result.error).toContain('positive')
  })

  it('returns error when description is empty', async () => {
    const result = await createTransaction({ error: null }, fd({ ...validData, description: '' }))
    expect(result.error).toContain('Description')
  })

  it('returns error when date is missing', async () => {
    const result = await createTransaction({ error: null }, fd({ ...validData, date: '' }))
    expect(result.error).toContain('Date')
  })

  it('returns error when accountId is missing', async () => {
    const result = await createTransaction({ error: null }, fd({ ...validData, accountId: '' }))
    expect(result.error).toContain('account')
  })

  it('decrements account balance for EXPENSE', async () => {
    await expect(createTransaction({ error: null }, fd(validData))).rejects.toThrow('NEXT_REDIRECT:/transactions')
    expect(mockAccountUpdate).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
      data: { balance: { decrement: 100 } },
    })
  })

  it('increments account balance for INCOME', async () => {
    await expect(
      createTransaction({ error: null }, fd({ ...validData, type: 'INCOME' }))
    ).rejects.toThrow('NEXT_REDIRECT:/transactions')
    expect(mockAccountUpdate).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
      data: { balance: { increment: 100 } },
    })
  })

  it('does not touch account balance for TRANSFER', async () => {
    await expect(
      createTransaction({ error: null }, fd({ ...validData, type: 'TRANSFER' }))
    ).rejects.toThrow('NEXT_REDIRECT:/transactions')
    expect(mockAccountUpdate).not.toHaveBeenCalled()
  })

  it('updates matching budget spent when category matches', async () => {
    const budget = { id: 'b1', spent: 0 }
    mockBudgetFindFirst.mockResolvedValue(budget)

    await expect(
      createTransaction({ error: null }, fd({ ...validData, categoryId: 'cat-1' }))
    ).rejects.toThrow('NEXT_REDIRECT:/transactions')

    expect(mockBudgetUpdate).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: { spent: { increment: 100 } },
    })
  })

  it('does not update budget when no matching budget exists', async () => {
    mockBudgetFindFirst.mockResolvedValue(null)
    await expect(
      createTransaction({ error: null }, fd({ ...validData, categoryId: 'cat-1' }))
    ).rejects.toThrow('NEXT_REDIRECT:/transactions')
    expect(mockBudgetUpdate).not.toHaveBeenCalled()
  })

  it('redirects to /transactions on success', async () => {
    await expect(createTransaction({ error: null }, fd(validData))).rejects.toThrow(
      'NEXT_REDIRECT:/transactions'
    )
  })
})

// ─── deleteTransaction ────────────────────────────────────────────────────

describe('deleteTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ userId: 'u1', email: 'a@b.com', name: null })
    mockBudgetFindFirst.mockResolvedValue(null)
  })

  it('redirects to /login when no session', async () => {
    mockGetSession.mockResolvedValue(null)
    await expect(deleteTransaction('tx-1')).rejects.toThrow('NEXT_REDIRECT:/login')
  })

  it('does nothing when transaction is not found (no-op)', async () => {
    mockTxFindUnique.mockResolvedValue(null)
    await deleteTransaction('tx-ghost')
    expect(mockTxDelete).not.toHaveBeenCalled()
  })

  it('reverses account balance for a deleted EXPENSE', async () => {
    mockTxFindUnique.mockResolvedValue({
      id: 'tx-1', userId: 'u1', type: 'EXPENSE', amount: 75, accountId: 'acc-1',
      categoryId: null, date: new Date('2026-02-01'),
    })

    await deleteTransaction('tx-1')

    expect(mockAccountUpdate).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
      data: { balance: { increment: 75 } },
    })
  })

  it('reverses account balance for a deleted INCOME', async () => {
    mockTxFindUnique.mockResolvedValue({
      id: 'tx-2', userId: 'u1', type: 'INCOME', amount: 500, accountId: 'acc-1',
      categoryId: null, date: new Date('2026-02-01'),
    })

    await deleteTransaction('tx-2')

    expect(mockAccountUpdate).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
      data: { balance: { decrement: 500 } },
    })
  })

  it('decrements budget.spent when deleting a categorised EXPENSE', async () => {
    mockTxFindUnique.mockResolvedValue({
      id: 'tx-3', userId: 'u1', type: 'EXPENSE', amount: 50, accountId: 'acc-1',
      categoryId: 'cat-1', date: new Date('2026-02-01'),
    })
    mockBudgetFindFirst.mockResolvedValue({ id: 'b1' })

    await deleteTransaction('tx-3')

    expect(mockBudgetUpdate).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: { spent: { decrement: 50 } },
    })
  })
})
