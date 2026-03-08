import { claimTransactions, type ClaimableTransaction, type ClaimableBudget } from '@/lib/budget-claiming'

function makeTx(overrides: Partial<ClaimableTransaction> = {}): ClaimableTransaction {
  return {
    id: `tx-${Math.random().toString(36).slice(2, 8)}`,
    amount: -50,
    merchant: 'Test Merchant',
    categoryId: 'cat-1',
    annualExpenseId: null,
    category: { id: 'cat-1', name: 'Subscriptions' },
    tags: null,
    ...overrides,
  }
}

function makeBudget(overrides: Partial<ClaimableBudget> = {}): ClaimableBudget {
  return {
    id: `budget-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Subscriptions',
    amount: 100,
    tier: 'FLEXIBLE',
    categoryId: 'cat-1',
    annualExpense: null,
    ...overrides,
  }
}

describe('perk exclusion from budgets', () => {
  it('excludes perk_covered transactions from flexible budget spent', () => {
    const perkTx = makeTx({ id: 'tx-perk', amount: -15, tags: 'perk_covered' })
    const normalTx = makeTx({ id: 'tx-normal', amount: -50, tags: null })
    const budget = makeBudget({ id: 'b1' })

    const result = claimTransactions([budget], [perkTx, normalTx])

    // Only normalTx should be claimed
    const flexIds = result.flexibleClaimed.get('b1') ?? []
    expect(flexIds).toContain('tx-normal')
    expect(flexIds).not.toContain('tx-perk')
    expect(result.spentByBudget.get('b1')).toBe(50)
  })

  it('excludes perk_covered transactions from catch-all pool', () => {
    const perkTx = makeTx({
      id: 'tx-perk',
      amount: -15,
      tags: 'perk_covered',
      categoryId: null,
      category: null,
    })
    const normalTx = makeTx({
      id: 'tx-normal',
      amount: -30,
      categoryId: null,
      category: null,
      tags: null,
    })
    const catchAllBudget = makeBudget({
      id: 'b-catchall',
      name: 'Miscellaneous',
      categoryId: null,
    })

    const result = claimTransactions([catchAllBudget], [perkTx, normalTx])

    expect(result.catchAllTxIds).toContain('tx-normal')
    expect(result.catchAllTxIds).not.toContain('tx-perk')
    expect(result.spentByBudget.get('b-catchall')).toBe(30)
  })

  it('excludes perk_covered transactions from annual expense claiming', () => {
    const perkTx = makeTx({
      id: 'tx-perk',
      amount: -100,
      tags: 'perk_covered',
      annualExpenseId: 'ae-1',
    })
    const normalTx = makeTx({
      id: 'tx-normal',
      amount: -200,
      tags: null,
      annualExpenseId: 'ae-1',
    })
    const annualBudget = makeBudget({
      id: 'b-annual',
      tier: 'ANNUAL',
      annualExpense: { id: 'ae-1' },
    })

    const result = claimTransactions([annualBudget], [perkTx, normalTx])

    const annualIds = result.annualClaimed.get('ae-1') ?? []
    expect(annualIds).toContain('tx-normal')
    expect(annualIds).not.toContain('tx-perk')
    expect(result.spentByBudget.get('b-annual')).toBe(200)
  })

  it('excludes perk_covered transactions from fixed budget claiming', () => {
    const perkTx = makeTx({
      id: 'tx-perk',
      amount: -50,
      tags: 'perk_covered',
      categoryId: 'cat-fixed',
      category: { id: 'cat-fixed', name: 'Internet' },
    })
    const normalTx = makeTx({
      id: 'tx-normal',
      amount: -55,
      tags: null,
      categoryId: 'cat-fixed',
      category: { id: 'cat-fixed', name: 'Internet' },
    })
    const fixedBudget = makeBudget({
      id: 'b-fixed',
      tier: 'FIXED',
      amount: 50,
      categoryId: 'cat-fixed',
    })

    const result = claimTransactions([fixedBudget], [perkTx, normalTx])

    // Fixed should claim normalTx, not the perk-covered one
    expect(result.fixedClaimed.get('b-fixed')).toBe('tx-normal')
    expect(result.spentByBudget.get('b-fixed')).toBe(55)
  })

  it('handles transactions with card_benefit tag alongside perk_covered', () => {
    const perkTx = makeTx({
      id: 'tx-multi-tag',
      amount: -15,
      tags: 'card_benefit:Uber Cash,perk_covered',
    })
    const normalTx = makeTx({ id: 'tx-normal', amount: -50, tags: null })
    const budget = makeBudget({ id: 'b1' })

    const result = claimTransactions([budget], [perkTx, normalTx])

    const flexIds = result.flexibleClaimed.get('b1') ?? []
    expect(flexIds).not.toContain('tx-multi-tag')
    expect(flexIds).toContain('tx-normal')
  })

  it('does not exclude transactions without perk_covered tag', () => {
    const regularTagTx = makeTx({ id: 'tx-tagged', amount: -25, tags: 'card_benefit:NYT' })
    const normalTx = makeTx({ id: 'tx-normal', amount: -50, tags: null })
    const budget = makeBudget({ id: 'b1' })

    const result = claimTransactions([budget], [regularTagTx, normalTx])

    const flexIds = result.flexibleClaimed.get('b1') ?? []
    expect(flexIds).toContain('tx-tagged')
    expect(flexIds).toContain('tx-normal')
    expect(result.spentByBudget.get('b1')).toBe(75)
  })
})
