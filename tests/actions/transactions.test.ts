import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks ---

const mockTxCreate = vi.fn()
const mockAccountUpdate = vi.fn()
const mockTxFindUnique = vi.fn()
const mockTxDelete = vi.fn()
const mockCategoryFindUnique = vi.fn()

const mockPrismaTx = {
  transaction: { create: mockTxCreate, findUnique: mockTxFindUnique, delete: mockTxDelete },
  account: { update: mockAccountUpdate },
}

vi.mock('@/lib/db', () => ({
  db: {
    $transaction: vi.fn((fn: (tx: typeof mockPrismaTx) => Promise<unknown>) => fn(mockPrismaTx)),
    category: { findUnique: (...args: unknown[]) => mockCategoryFindUnique(...args) },
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
  merchant: 'Test merchant',
  date: '2026-02-01',
  accountId: 'acc-1',
  categoryId: '',
  notes: '',
}

// ─── createTransaction ────────────────────────────────────────────────────

describe('createTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ userId: 'u1', email: 'a@b.com', name: null })
    mockCategoryFindUnique.mockResolvedValue(null)
  })

  it('redirects to /login when no session', async () => {
    mockGetSession.mockResolvedValue(null)
    await expect(createTransaction({ error: null }, fd(validData))).rejects.toThrow('NEXT_REDIRECT:/login')
  })

  it('returns error for amount = 0', async () => {
    const result = await createTransaction({ error: null }, fd({ ...validData, amount: '0' }))
    expect(result.error).toContain('non-zero')
  })

  it('returns error when merchant is empty', async () => {
    const result = await createTransaction({ error: null }, fd({ ...validData, merchant: '' }))
    expect(result.error).toContain('Merchant')
  })

  it('returns error when date is missing', async () => {
    const result = await createTransaction({ error: null }, fd({ ...validData, date: '' }))
    expect(result.error).toContain('Date')
  })

  it('adjusts account balance with increment for positive amount', async () => {
    await expect(createTransaction({ error: null }, fd(validData))).rejects.toThrow('NEXT_REDIRECT:/transactions')
    expect(mockAccountUpdate).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
      data: { balance: { increment: 100 } },
    })
  })

  it('makes amount negative for expense category', async () => {
    mockCategoryFindUnique.mockResolvedValue({ id: 'cat-1', type: 'expense' })

    await expect(
      createTransaction({ error: null }, fd({ ...validData, categoryId: 'cat-1' }))
    ).rejects.toThrow('NEXT_REDIRECT:/transactions')

    expect(mockTxCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: -100 }),
      })
    )
    expect(mockAccountUpdate).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
      data: { balance: { increment: -100 } },
    })
  })

  it('keeps amount positive for income category', async () => {
    mockCategoryFindUnique.mockResolvedValue({ id: 'cat-1', type: 'income' })

    await expect(
      createTransaction({ error: null }, fd({ ...validData, categoryId: 'cat-1' }))
    ).rejects.toThrow('NEXT_REDIRECT:/transactions')

    expect(mockTxCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: 100 }),
      })
    )
  })

  it('does not adjust account balance when no accountId', async () => {
    await expect(
      createTransaction({ error: null }, fd({ ...validData, accountId: '' }))
    ).rejects.toThrow('NEXT_REDIRECT:/transactions')
    expect(mockAccountUpdate).not.toHaveBeenCalled()
  })

  it('does not update budget spent (spent is computed on read)', async () => {
    mockCategoryFindUnique.mockResolvedValue({ id: 'cat-1', type: 'expense' })

    await expect(
      createTransaction({ error: null }, fd({ ...validData, categoryId: 'cat-1' }))
    ).rejects.toThrow('NEXT_REDIRECT:/transactions')

    // No budget update calls — spent is computed from transactions on read
    // Only account update should be called
    expect(mockAccountUpdate).toHaveBeenCalledTimes(1)
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

  it('reverses account balance for a deleted expense (negative amount)', async () => {
    mockTxFindUnique.mockResolvedValue({
      id: 'tx-1', userId: 'u1', amount: -75, accountId: 'acc-1',
      categoryId: null, date: new Date('2026-02-01'),
    })

    await deleteTransaction('tx-1')

    // Reverse: increment by -(-75) = +75
    expect(mockAccountUpdate).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
      data: { balance: { increment: 75 } },
    })
  })

  it('reverses account balance for a deleted income (positive amount)', async () => {
    mockTxFindUnique.mockResolvedValue({
      id: 'tx-2', userId: 'u1', amount: 500, accountId: 'acc-1',
      categoryId: null, date: new Date('2026-02-01'),
    })

    await deleteTransaction('tx-2')

    // Reverse: increment by -(500) = -500
    expect(mockAccountUpdate).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
      data: { balance: { increment: -500 } },
    })
  })

  it('does not adjust balance when no accountId', async () => {
    mockTxFindUnique.mockResolvedValue({
      id: 'tx-4', userId: 'u1', amount: -50, accountId: null,
      categoryId: null, date: new Date('2026-02-01'),
    })

    await deleteTransaction('tx-4')

    expect(mockAccountUpdate).not.toHaveBeenCalled()
  })

  it('does not update budget spent on delete (spent is computed on read)', async () => {
    mockTxFindUnique.mockResolvedValue({
      id: 'tx-3', userId: 'u1', amount: -50, accountId: 'acc-1',
      categoryId: 'cat-1', date: new Date('2026-02-01'),
    })

    await deleteTransaction('tx-3')

    // Account balance reversed, but no budget update
    expect(mockAccountUpdate).toHaveBeenCalledTimes(1)
  })
})
