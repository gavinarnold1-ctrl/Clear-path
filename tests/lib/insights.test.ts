import { vi } from 'vitest'

// Mock the db module before importing anything that uses it
vi.mock('@/lib/db', () => ({
  db: {
    transaction: {
      findMany: vi.fn(),
    },
    insight: {
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    efficiencyScore: {
      upsert: vi.fn(),
    },
  },
}))

// Mock the AI module
vi.mock('@/lib/ai', () => ({
  generateInsights: vi.fn(),
}))

import { db } from '@/lib/db'
import { buildTransactionSummary } from '@/lib/insights'

function makeTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tx-1',
    amount: 100,
    description: 'Test Transaction',
    date: new Date('2026-01-15'),
    type: 'EXPENSE' as const,
    notes: null,
    userId: 'user-1',
    accountId: 'acc-1',
    categoryId: 'cat-1',
    category: { id: 'cat-1', name: 'Groceries', color: '#22c55e', icon: null, type: 'EXPENSE', userId: 'user-1' },
    account: { id: 'acc-1', name: 'Checking', type: 'CHECKING', balance: 1000, currency: 'USD', userId: 'user-1' },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('buildTransactionSummary', () => {
  it('correctly splits income and expenses', async () => {
    const mockTransactions = [
      makeTransaction({ type: 'INCOME', amount: 5000, description: 'Salary', category: { id: 'cat-2', name: 'Salary', color: '#6366f1', icon: null, type: 'INCOME', userId: 'user-1' } }),
      makeTransaction({ type: 'EXPENSE', amount: 200, description: 'Grocery Store' }),
      makeTransaction({ type: 'EXPENSE', amount: 50, description: 'Coffee Shop', category: { id: 'cat-3', name: 'Dining', color: '#ef4444', icon: null, type: 'EXPENSE', userId: 'user-1' } }),
    ]
    vi.mocked(db.transaction.findMany).mockResolvedValue(mockTransactions)

    const summary = await buildTransactionSummary('user-1', 3)

    expect(summary.totalIncome).toBe(5000)
    expect(summary.totalExpenses).toBe(250)
    expect(summary.netSavings).toBe(4750)
    expect(summary.savingsRate).toBeCloseTo(95, 0)
  })

  it('computes category breakdown correctly', async () => {
    const mockTransactions = [
      makeTransaction({ description: 'Store A', amount: 100 }),
      makeTransaction({ description: 'Store B', amount: 150 }),
      makeTransaction({ description: 'Coffee', amount: 30, category: { id: 'cat-3', name: 'Dining', color: '#ef4444', icon: null, type: 'EXPENSE', userId: 'user-1' } }),
    ]
    vi.mocked(db.transaction.findMany).mockResolvedValue(mockTransactions)

    const summary = await buildTransactionSummary('user-1', 3)

    expect(summary.categoryBreakdown).toHaveLength(2)
    const groceries = summary.categoryBreakdown.find((c) => c.category === 'Groceries')
    expect(groceries).toBeDefined()
    expect(groceries!.total).toBe(250)
    expect(groceries!.transactionCount).toBe(2)
    expect(groceries!.avgTransaction).toBe(125)
  })

  it('identifies top merchants sorted by total spend', async () => {
    const mockTransactions = [
      makeTransaction({ description: 'Store A', amount: 300 }),
      makeTransaction({ description: 'Store B', amount: 100 }),
      makeTransaction({ description: 'Store A', amount: 200 }),
    ]
    vi.mocked(db.transaction.findMany).mockResolvedValue(mockTransactions)

    const summary = await buildTransactionSummary('user-1', 3)

    expect(summary.topMerchants[0].name).toBe('Store A')
    expect(summary.topMerchants[0].total).toBe(500)
    expect(summary.topMerchants[0].count).toBe(2)
    expect(summary.topMerchants[1].name).toBe('Store B')
    expect(summary.topMerchants[1].total).toBe(100)
  })

  it('detects recurring charges with similar amounts', async () => {
    const mockTransactions = [
      makeTransaction({ description: 'Netflix', amount: 15.99 }),
      makeTransaction({ description: 'Netflix', amount: 15.99 }),
      makeTransaction({ description: 'Netflix', amount: 15.99 }),
    ]
    vi.mocked(db.transaction.findMany).mockResolvedValue(mockTransactions)

    const summary = await buildTransactionSummary('user-1', 3)

    expect(summary.recurringCharges).toHaveLength(1)
    expect(summary.recurringCharges[0].description).toBe('Netflix')
    expect(summary.recurringCharges[0].amount).toBeCloseTo(15.99)
    expect(summary.recurringCharges[0].frequency).toBe('monthly')
  })

  it('does not flag single transactions as recurring', async () => {
    const mockTransactions = [
      makeTransaction({ description: 'One-time purchase', amount: 500 }),
    ]
    vi.mocked(db.transaction.findMany).mockResolvedValue(mockTransactions)

    const summary = await buildTransactionSummary('user-1', 3)

    expect(summary.recurringCharges).toHaveLength(0)
  })

  it('does not flag varying amounts as recurring', async () => {
    const mockTransactions = [
      makeTransaction({ description: 'Grocery Store', amount: 50 }),
      makeTransaction({ description: 'Grocery Store', amount: 120 }),
      makeTransaction({ description: 'Grocery Store', amount: 200 }),
    ]
    vi.mocked(db.transaction.findMany).mockResolvedValue(mockTransactions)

    const summary = await buildTransactionSummary('user-1', 3)

    // Amounts vary by more than 10%, so should not be flagged
    expect(summary.recurringCharges).toHaveLength(0)
  })

  it('returns correct period metadata', async () => {
    vi.mocked(db.transaction.findMany).mockResolvedValue([])

    const summary = await buildTransactionSummary('user-1', 6)

    expect(summary.period.months).toBe(6)
    expect(summary.period.end).toBe(new Date().toISOString().split('T')[0])
  })

  it('handles zero income gracefully (savingsRate = 0)', async () => {
    const mockTransactions = [
      makeTransaction({ type: 'EXPENSE', amount: 100 }),
    ]
    vi.mocked(db.transaction.findMany).mockResolvedValue(mockTransactions)

    const summary = await buildTransactionSummary('user-1', 3)

    expect(summary.totalIncome).toBe(0)
    expect(summary.savingsRate).toBe(0)
  })

  it('attaches benchmark data to known categories', async () => {
    const mockTransactions = [
      makeTransaction({ description: 'Store', amount: 500 }),
    ]
    vi.mocked(db.transaction.findMany).mockResolvedValue(mockTransactions)

    const summary = await buildTransactionSummary('user-1', 1)

    const groceries = summary.categoryBreakdown.find((c) => c.category === 'Groceries')
    expect(groceries).toBeDefined()
    expect(groceries!.benchmark).toBeDefined()
    expect(groceries!.benchmark!.median).toBe(475)
  })

  it('returns empty arrays when no transactions exist', async () => {
    vi.mocked(db.transaction.findMany).mockResolvedValue([])

    const summary = await buildTransactionSummary('user-1', 3)

    expect(summary.totalIncome).toBe(0)
    expect(summary.totalExpenses).toBe(0)
    expect(summary.categoryBreakdown).toHaveLength(0)
    expect(summary.topMerchants).toHaveLength(0)
    expect(summary.recurringCharges).toHaveLength(0)
    expect(summary.monthOverMonthChange).toHaveLength(0)
  })
})
