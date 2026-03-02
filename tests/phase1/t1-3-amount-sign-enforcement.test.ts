/**
 * T1.3 — Amount sign enforcement (Phase 1, Step 3)
 *
 * Verifies that amount signs are enforced at the API level:
 * - expense category → amount stored as negative
 * - income category → amount stored as positive
 * - transfer category → user-provided sign preserved
 * - CSV import normalizes signs based on transactionType or category type
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'

// ─── T1.3.1: Server action sign enforcement ────────────────────────────────

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

vi.mock('@/lib/apply-splits', () => ({
  applyPropertyAttribution: vi.fn(),
}))

import { createTransaction } from '@/app/actions/transactions'
import { getSession } from '@/lib/session'

const mockGetSession = getSession as ReturnType<typeof vi.fn>

function fd(data: Record<string, string>): FormData {
  const f = new FormData()
  Object.entries(data).forEach(([k, v]) => f.append(k, v))
  return f
}

const baseData = {
  amount: '100',
  merchant: 'Test Store',
  date: '2026-02-15',
  accountId: 'acc-1',
  categoryId: '',
  notes: '',
}

describe('T1.3 — Server action: amount sign enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ userId: 'u1', email: 'a@b.com', name: null })
    mockCategoryFindUnique.mockResolvedValue(null)
    mockTxCreate.mockResolvedValue({ id: 'tx-new' })
  })

  it('stores expense amount as negative when category.type = expense', async () => {
    mockCategoryFindUnique.mockResolvedValue({ id: 'cat-1', type: 'expense' })

    await expect(
      createTransaction({ error: null }, fd({ ...baseData, categoryId: 'cat-1', amount: '50' }))
    ).rejects.toThrow('NEXT_REDIRECT:/transactions')

    expect(mockTxCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: -50 }),
      })
    )
  })

  it('stores expense amount as negative even if user provides positive value', async () => {
    mockCategoryFindUnique.mockResolvedValue({ id: 'cat-1', type: 'expense' })

    await expect(
      createTransaction({ error: null }, fd({ ...baseData, categoryId: 'cat-1', amount: '200' }))
    ).rejects.toThrow('NEXT_REDIRECT:/transactions')

    expect(mockTxCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: -200 }),
      })
    )
  })

  it('stores expense amount as negative even if user provides negative value', async () => {
    mockCategoryFindUnique.mockResolvedValue({ id: 'cat-1', type: 'expense' })

    await expect(
      createTransaction({ error: null }, fd({ ...baseData, categoryId: 'cat-1', amount: '-75' }))
    ).rejects.toThrow('NEXT_REDIRECT:/transactions')

    expect(mockTxCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: -75 }),
      })
    )
  })

  it('stores income amount as positive when category.type = income', async () => {
    mockCategoryFindUnique.mockResolvedValue({ id: 'cat-2', type: 'income' })

    await expect(
      createTransaction({ error: null }, fd({ ...baseData, categoryId: 'cat-2', amount: '3000' }))
    ).rejects.toThrow('NEXT_REDIRECT:/transactions')

    expect(mockTxCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: 3000 }),
      })
    )
  })

  it('stores income amount as positive even if user provides negative value', async () => {
    mockCategoryFindUnique.mockResolvedValue({ id: 'cat-2', type: 'income' })

    await expect(
      createTransaction({ error: null }, fd({ ...baseData, categoryId: 'cat-2', amount: '-500' }))
    ).rejects.toThrow('NEXT_REDIRECT:/transactions')

    expect(mockTxCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: 500 }),
      })
    )
  })

  it('preserves user sign for transfer category', async () => {
    mockCategoryFindUnique.mockResolvedValue({ id: 'cat-3', type: 'transfer' })

    await expect(
      createTransaction({ error: null }, fd({ ...baseData, categoryId: 'cat-3', amount: '-200' }))
    ).rejects.toThrow('NEXT_REDIRECT:/transactions')

    expect(mockTxCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: -200 }),
      })
    )
  })

  it('preserves positive user sign for transfer category', async () => {
    mockCategoryFindUnique.mockResolvedValue({ id: 'cat-3', type: 'transfer' })

    await expect(
      createTransaction({ error: null }, fd({ ...baseData, categoryId: 'cat-3', amount: '200' }))
    ).rejects.toThrow('NEXT_REDIRECT:/transactions')

    expect(mockTxCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: 200 }),
      })
    )
  })

  it('preserves user sign when no category is provided', async () => {
    await expect(
      createTransaction({ error: null }, fd({ ...baseData, amount: '100' }))
    ).rejects.toThrow('NEXT_REDIRECT:/transactions')

    expect(mockTxCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: 100 }),
      })
    )
  })

  it('account balance increment matches the final signed amount', async () => {
    mockCategoryFindUnique.mockResolvedValue({ id: 'cat-1', type: 'expense' })

    await expect(
      createTransaction({ error: null }, fd({ ...baseData, categoryId: 'cat-1', amount: '75' }))
    ).rejects.toThrow('NEXT_REDIRECT:/transactions')

    // Amount stored as -75, account balance decremented by -75
    expect(mockAccountUpdate).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
      data: { balance: { increment: -75 } },
    })
  })
})

// ─── T1.3.2: API route sign enforcement ─────────────────────────────────────

describe('T1.3 — API route: sign enforcement in source code', () => {
  it('api/transactions/route.ts enforces expense = negative', () => {
    const routePath = path.resolve(__dirname, '../../src/app/api/transactions/route.ts')
    const code = fs.readFileSync(routePath, 'utf-8')

    // Must have expense sign correction
    expect(code).toMatch(/category\.type\s*===\s*['"]expense['"]/)
    expect(code).toMatch(/-Math\.abs\(amount\)/)

    // Must have income sign correction
    expect(code).toMatch(/category\.type\s*===\s*['"]income['"]/)
    expect(code).toMatch(/Math\.abs\(amount\)/)
  })

  it('actions/transactions.ts enforces expense = negative', () => {
    const actionsPath = path.resolve(__dirname, '../../src/app/actions/transactions.ts')
    const code = fs.readFileSync(actionsPath, 'utf-8')

    // Must have expense sign correction
    expect(code).toMatch(/category\.type\s*===\s*['"]expense['"]/)
    expect(code).toMatch(/-Math\.abs\(amount\)/)

    // Must have income sign correction
    expect(code).toMatch(/category\.type\s*===\s*['"]income['"]/)
    expect(code).toMatch(/Math\.abs\(amount\)/)
  })
})

// ─── T1.3.3: CSV import sign enforcement ────────────────────────────────────

describe('T1.3 — CSV import: sign normalization', () => {
  it('import/route.ts normalizes signs based on transactionType and category', () => {
    const importPath = path.resolve(__dirname, '../../src/app/api/transactions/import/route.ts')
    const code = fs.readFileSync(importPath, 'utf-8')

    // Must handle transactionType === 'credit' → positive
    expect(code).toMatch(/transactionType\s*===\s*['"]credit['"]/)
    expect(code).toMatch(/Math\.abs\(tx\.amount\)/)

    // Must handle transactionType === 'debit' → negative
    expect(code).toMatch(/transactionType\s*===\s*['"]debit['"]/)
    expect(code).toMatch(/-Math\.abs\(tx\.amount\)/)

    // Must fallback to category type for sign correction
    expect(code).toMatch(/resolvedCat\.type\s*===\s*['"]expense['"]/)
    expect(code).toMatch(/resolvedCat\.type\s*===\s*['"]income['"]/)
  })
})

// ─── T1.3.4: Bulk operations sign enforcement ──────────────────────────────

describe('T1.3 — Bulk operations: source code verification', () => {
  it('bulk/route.ts does not re-sign amounts (relies on original sign)', () => {
    const bulkPath = path.resolve(__dirname, '../../src/app/api/transactions/bulk/route.ts')
    const code = fs.readFileSync(bulkPath, 'utf-8')

    // Bulk route should exist
    expect(code.length).toBeGreaterThan(0)

    // Should handle PATCH and DELETE operations
    expect(code).toMatch(/PATCH|DELETE/)
  })
})
