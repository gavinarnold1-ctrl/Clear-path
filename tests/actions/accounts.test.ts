import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    account: {
      create: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
    },
    transaction: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
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

import { createAccount, deleteAccount } from '@/app/actions/accounts'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

const mockGetSession = getSession as ReturnType<typeof vi.fn>
const mockAccount = db.account as { create: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn> }
const mockDb = db as unknown as { $transaction: ReturnType<typeof vi.fn> }

function fd(data: Record<string, string>): FormData {
  const f = new FormData()
  Object.entries(data).forEach(([k, v]) => f.append(k, v))
  return f
}

const validData = { name: 'Checking', type: 'CHECKING', balance: '1000', currency: 'USD' }

describe('createAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ userId: 'u1', email: 'a@b.com', name: null })
    mockAccount.create.mockResolvedValue({ id: 'acc-1' })
    mockAccount.findFirst.mockResolvedValue(null) // no duplicate by default
  })

  it('redirects to /login when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null)
    await expect(createAccount({ error: null }, fd(validData))).rejects.toThrow('NEXT_REDIRECT:/login')
  })

  it('returns error when name is empty', async () => {
    const result = await createAccount({ error: null }, fd({ ...validData, name: '' }))
    expect(result.error).toContain('name')
  })

  it('returns error when balance is not a number', async () => {
    const result = await createAccount({ error: null }, fd({ ...validData, balance: 'abc' }))
    expect(result.error).toContain('valid number')
  })

  it('returns error when duplicate name exists', async () => {
    mockAccount.findFirst.mockResolvedValue({ id: 'existing', name: 'Checking' })
    const result = await createAccount({ error: null }, fd(validData))
    expect(result.error).toContain('already exists')
  })

  it('creates account with correct data and redirects', async () => {
    await expect(createAccount({ error: null }, fd(validData))).rejects.toThrow('NEXT_REDIRECT:/accounts')
    expect(mockAccount.create).toHaveBeenCalledWith({
      data: {
        userId: 'u1',
        name: 'Checking',
        type: 'CHECKING',
        balance: 1000,
        startingBalance: 1000,
        balanceAsOfDate: null,
        currency: 'USD',
      },
    })
  })

  it('defaults currency to USD when not provided', async () => {
    await expect(
      createAccount({ error: null }, fd({ name: 'Savings', type: 'SAVINGS', balance: '0', currency: '' }))
    ).rejects.toThrow('NEXT_REDIRECT:/accounts')
    const call = mockAccount.create.mock.calls[0][0]
    expect(call.data.currency).toBe('USD')
  })
})

describe('deleteAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ userId: 'u1', email: 'a@b.com', name: null })
    mockDb.$transaction.mockResolvedValue([{}, {}])
  })

  it('redirects to /login when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null)
    await expect(deleteAccount('acc-1')).rejects.toThrow('NEXT_REDIRECT:/login')
  })

  it('unlinks transactions and deletes with userId ownership guard', async () => {
    await deleteAccount('acc-1')
    expect(mockDb.$transaction).toHaveBeenCalledTimes(1)
  })
})
