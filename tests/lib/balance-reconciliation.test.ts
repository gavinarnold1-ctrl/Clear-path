import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindFirst = vi.fn()
const mockFindMany = vi.fn()
const mockAggregate = vi.fn()
const mockUpdate = vi.fn()
const mockCount = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    account: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    transaction: {
      aggregate: (...args: unknown[]) => mockAggregate(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
  },
}))

import { reconcileAccount } from '@/lib/balance-reconciliation'

describe('reconcileAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdate.mockResolvedValue({})
  })

  it('detects discrepancy between Plaid balance and computed balance', async () => {
    const lastSynced = new Date('2026-03-09T10:00:00Z')

    // Account lookup
    mockFindFirst.mockResolvedValueOnce({
      id: 'acc-1',
      name: 'Chase Checking',
      type: 'CHECKING',
      balance: 5000,
      startingBalance: 0,
      balanceAsOfDate: null,
      isManual: false,
      plaidLastSynced: lastSynced,
    })

    // computeExpectedBalance calls findFirst
    mockFindFirst.mockResolvedValueOnce({
      balance: 5000,
      startingBalance: 0,
      balanceAsOfDate: null,
      isManual: false,
      plaidLastSynced: lastSynced,
    })

    // Manual transactions since sync (computeExpectedBalance)
    mockAggregate.mockResolvedValueOnce({
      _sum: { amount: -200 },
      _count: { id: 2 },
    })
    // All transactions stats (computeExpectedBalance)
    mockAggregate.mockResolvedValueOnce({
      _min: { date: new Date('2026-01-01') },
      _max: { date: new Date('2026-03-11') },
      _count: { id: 50 },
    })

    // Transactions since sync count (reconcileAccount)
    mockCount.mockResolvedValueOnce(2)

    const result = await reconcileAccount('acc-1', 'user-1')

    expect(result.accountId).toBe('acc-1')
    expect(result.accountName).toBe('Chase Checking')
    expect(result.plaidBalance).toBe(5000)
    expect(result.computedBalance).toBe(4800) // 5000 + (-200)
    expect(result.discrepancy).toBe(200) // stored - computed
    expect(result.status).toBe('discrepancy')
    expect(result.possibleCauses).toContain('Manual transactions not reflected in Plaid balance')
    expect(result.transactionsSinceSync).toBe(2)
  })

  it('reports matched status when balances agree', async () => {
    const lastSynced = new Date('2026-03-11T10:00:00Z')

    mockFindFirst.mockResolvedValueOnce({
      id: 'acc-1',
      name: 'Chase Checking',
      type: 'CHECKING',
      balance: 5000,
      startingBalance: 0,
      balanceAsOfDate: null,
      isManual: false,
      plaidLastSynced: lastSynced,
    })

    mockFindFirst.mockResolvedValueOnce({
      balance: 5000,
      startingBalance: 0,
      balanceAsOfDate: null,
      isManual: false,
      plaidLastSynced: lastSynced,
    })

    // No manual transactions since sync
    mockAggregate.mockResolvedValueOnce({
      _sum: { amount: 0 },
      _count: { id: 0 },
    })
    mockAggregate.mockResolvedValueOnce({
      _min: { date: new Date('2026-01-01') },
      _max: { date: new Date('2026-03-11') },
      _count: { id: 50 },
    })

    mockCount.mockResolvedValueOnce(0)

    const result = await reconcileAccount('acc-1', 'user-1')

    expect(result.status).toBe('matched')
    expect(result.discrepancy).toBe(0)
    expect(result.possibleCauses).toHaveLength(0)

    // Matched accounts should NOT have balance overwritten
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          balance: expect.anything(),
        }),
      })
    )
  })

  it('flags manual accounts with no starting balance', async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 'acc-1',
      name: 'CSV Import',
      type: 'CHECKING',
      balance: 0,
      startingBalance: 0,
      balanceAsOfDate: null,
      isManual: true,
      plaidLastSynced: null,
    })

    mockFindFirst.mockResolvedValueOnce({
      balance: 0,
      startingBalance: 0,
      balanceAsOfDate: null,
      isManual: true,
      plaidLastSynced: null,
    })

    // Transactions sum to -500
    mockAggregate.mockResolvedValueOnce({
      _sum: { amount: -500 },
    })
    mockAggregate.mockResolvedValueOnce({
      _min: { date: new Date('2026-02-01') },
      _max: { date: new Date('2026-03-01') },
      _count: { id: 10 },
    })

    const result = await reconcileAccount('acc-1', 'user-1')

    expect(result.isManual).toBe(true)
    expect(result.plaidBalance).toBeNull()
    expect(result.computedBalance).toBe(-500)
    expect(result.discrepancy).toBe(500) // 0 - (-500) = 500
    expect(result.status).toBe('discrepancy')
    expect(result.possibleCauses).toContain('No balance-as-of date set — starting balance may be inaccurate')
    expect(result.possibleCauses).toContain('Starting balance is $0 — set a starting balance for accuracy')

    // Manual accounts with discrepancy get their balance auto-fixed
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          balance: -500,
          balanceSource: 'computed',
        }),
      })
    )
  })

  it('throws when account not found', async () => {
    mockFindFirst.mockResolvedValueOnce(null)

    await expect(reconcileAccount('nonexistent', 'user-1')).rejects.toThrow('Account not found')
  })
})
