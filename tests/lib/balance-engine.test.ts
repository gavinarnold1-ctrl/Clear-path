import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock db before importing the module
const mockFindFirst = vi.fn()
const mockAggregate = vi.fn()
const mockUpdate = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    account: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    transaction: {
      aggregate: (...args: unknown[]) => mockAggregate(...args),
    },
  },
}))

import { computeExpectedBalance, recomputeAccountBalance } from '@/lib/balance-engine'

describe('computeExpectedBalance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns zero balance when account not found', async () => {
    mockFindFirst.mockResolvedValue(null)

    const result = await computeExpectedBalance('acc-1', 'user-1')

    expect(result.computedBalance).toBe(0)
    expect(result.transactionCount).toBe(0)
    expect(result.oldestTransaction).toBeNull()
    expect(result.newestTransaction).toBeNull()
  })

  it('computes balance for manual account with starting balance and transactions', async () => {
    mockFindFirst.mockResolvedValue({
      balance: 5200,
      startingBalance: 5000,
      balanceAsOfDate: new Date('2026-02-25'),
      isManual: true,
      plaidLastSynced: null,
    })

    // First aggregate call: sum of transactions after balanceAsOfDate
    mockAggregate.mockResolvedValueOnce({
      _sum: { amount: 200 },
    })
    // Second aggregate call: stats (min/max/count)
    mockAggregate.mockResolvedValueOnce({
      _min: { date: new Date('2026-01-01') },
      _max: { date: new Date('2026-03-10') },
      _count: { id: 5 },
    })

    const result = await computeExpectedBalance('acc-1', 'user-1')

    expect(result.computedBalance).toBe(5200)
    expect(result.transactionCount).toBe(5)
    expect(result.oldestTransaction).toEqual(new Date('2026-01-01'))
    expect(result.newestTransaction).toEqual(new Date('2026-03-10'))
  })

  it('computes balance for manual account with no balanceAsOfDate', async () => {
    mockFindFirst.mockResolvedValue({
      balance: 1000,
      startingBalance: 1000,
      balanceAsOfDate: null,
      isManual: true,
      plaidLastSynced: null,
    })

    mockAggregate.mockResolvedValueOnce({
      _sum: { amount: -300 },
    })
    mockAggregate.mockResolvedValueOnce({
      _min: { date: new Date('2026-02-01') },
      _max: { date: new Date('2026-03-01') },
      _count: { id: 3 },
    })

    const result = await computeExpectedBalance('acc-1', 'user-1')

    expect(result.computedBalance).toBe(700)
    expect(result.transactionCount).toBe(3)
  })

  it('computes balance for Plaid account with manual transactions since sync', async () => {
    const lastSynced = new Date('2026-03-10T10:00:00Z')
    mockFindFirst.mockResolvedValue({
      balance: 5000,
      startingBalance: 0,
      balanceAsOfDate: null,
      isManual: false,
      plaidLastSynced: lastSynced,
    })

    // Manual transactions since sync
    mockAggregate.mockResolvedValueOnce({
      _sum: { amount: -200 },
      _count: { id: 2 },
    })
    // All transactions stats
    mockAggregate.mockResolvedValueOnce({
      _min: { date: new Date('2026-01-01') },
      _max: { date: new Date('2026-03-11') },
      _count: { id: 50 },
    })

    const result = await computeExpectedBalance('acc-1', 'user-1')

    expect(result.computedBalance).toBe(4800) // 5000 + (-200)
    expect(result.transactionCount).toBe(50)
  })
})

describe('recomputeAccountBalance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 0 for non-manual accounts', async () => {
    mockFindFirst.mockResolvedValue({
      startingBalance: 0,
      balanceAsOfDate: null,
      isManual: false,
    })

    const result = await recomputeAccountBalance('acc-1', 'user-1')

    expect(result).toBe(0)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('recomputes and updates balance for manual accounts', async () => {
    mockFindFirst.mockResolvedValue({
      startingBalance: 5000,
      balanceAsOfDate: new Date('2026-02-25'),
      isManual: true,
    })

    mockAggregate.mockResolvedValue({
      _sum: { amount: 200 },
    })

    mockUpdate.mockResolvedValue({})

    const result = await recomputeAccountBalance('acc-1', 'user-1')

    expect(result).toBe(5200)
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
      data: { balance: 5200, balanceSource: 'computed' },
    })
  })
})
