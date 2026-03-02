import { describe, it, expect } from 'vitest'
import {
  matchSplitRule,
  applySplit,
  batchMatchAndSplit,
  type SplitRuleData,
  type PropertyInfo,
} from '@/lib/engines/split'

// ─── matchSplitRule ──────────────────────────────────────────────────────────

describe('matchSplitRule', () => {
  const rules: SplitRuleData[] = [
    {
      id: 'r1',
      matchField: 'merchant',
      matchPattern: 'Wells Fargo',
      allocations: [{ propertyId: 'p1', percentage: 60 }, { propertyId: 'p2', percentage: 40 }],
      isActive: true,
    },
    {
      id: 'r2',
      matchField: 'category',
      matchPattern: 'Property Tax',
      allocations: [{ propertyId: 'p1', percentage: 50 }, { propertyId: 'p2', percentage: 50 }],
      isActive: true,
    },
    {
      id: 'r3',
      matchField: 'description',
      matchPattern: 'HOA dues',
      allocations: [{ propertyId: 'p1', percentage: 100 }],
      isActive: true,
    },
    {
      id: 'r4',
      matchField: 'merchant',
      matchPattern: 'Inactive Rule',
      allocations: [{ propertyId: 'p1', percentage: 100 }],
      isActive: false,
    },
  ]

  it('matches merchant case-insensitively', () => {
    const tx = { merchant: 'WELLS FARGO MORTGAGE', description: 'Monthly payment' }
    const result = matchSplitRule(tx, rules)
    expect(result).not.toBeNull()
    expect(result!.id).toBe('r1')
  })

  it('matches by partial merchant name', () => {
    const tx = { merchant: 'Payment to Wells Fargo Bank', description: null }
    const result = matchSplitRule(tx, rules)
    expect(result).not.toBeNull()
    expect(result!.id).toBe('r1')
  })

  it('matches by category name', () => {
    const tx = { merchant: 'County Tax Office', categoryName: 'Property Tax & Assessment' }
    const result = matchSplitRule(tx, rules)
    expect(result).not.toBeNull()
    expect(result!.id).toBe('r2')
  })

  it('matches by description', () => {
    const tx = { merchant: 'Unknown', description: 'Monthly HOA dues payment' }
    const result = matchSplitRule(tx, rules)
    expect(result).not.toBeNull()
    expect(result!.id).toBe('r3')
  })

  it('returns null when no rule matches', () => {
    const tx = { merchant: 'Target', description: 'Groceries', categoryName: 'Shopping' }
    const result = matchSplitRule(tx, rules)
    expect(result).toBeNull()
  })

  it('skips inactive rules', () => {
    const tx = { merchant: 'Inactive Rule Company' }
    const result = matchSplitRule(tx, rules)
    expect(result).toBeNull()
  })

  it('returns first matching rule', () => {
    // Create a transaction that could match both r1 and r2
    const multiRules: SplitRuleData[] = [
      { id: 'a', matchField: 'merchant', matchPattern: 'test', allocations: [], isActive: true },
      { id: 'b', matchField: 'merchant', matchPattern: 'test', allocations: [], isActive: true },
    ]
    const tx = { merchant: 'Test Corp' }
    const result = matchSplitRule(tx, multiRules)
    expect(result!.id).toBe('a')
  })

  it('handles empty merchant string', () => {
    const tx = { merchant: '' }
    const result = matchSplitRule(tx, rules)
    expect(result).toBeNull()
  })

  it('handles null description', () => {
    const tx = { merchant: 'Something', description: null }
    const result = matchSplitRule(tx, [
      { id: 'x', matchField: 'description', matchPattern: 'test', allocations: [], isActive: true },
    ])
    expect(result).toBeNull()
  })
})

// ─── applySplit ──────────────────────────────────────────────────────────────

describe('applySplit', () => {
  const propertyLookup = new Map<string, PropertyInfo>([
    ['p1', { name: 'Home', taxSchedule: 'SCHEDULE_A' }],
    ['p2', { name: 'Unit A', taxSchedule: 'SCHEDULE_E' }],
    ['p3', { name: 'Unit B', taxSchedule: 'SCHEDULE_E' }],
    ['p4', { name: 'Business', taxSchedule: 'SCHEDULE_C' }],
  ])

  it('correctly splits an even amount', () => {
    const allocations = [
      { propertyId: 'p1', percentage: 50 },
      { propertyId: 'p2', percentage: 50 },
    ]
    const result = applySplit(-1000, allocations, propertyLookup)

    expect(result).toHaveLength(2)
    expect(result[0].amount).toBe(-500)
    expect(result[1].amount).toBe(-500)
    expect(result[0].propertyName).toBe('Home')
    expect(result[1].propertyName).toBe('Unit A')
  })

  it('handles uneven percentages with rounding', () => {
    const allocations = [
      { propertyId: 'p1', percentage: 33.33 },
      { propertyId: 'p2', percentage: 33.33 },
      { propertyId: 'p3', percentage: 33.34 },
    ]
    const result = applySplit(-100, allocations, propertyLookup)

    // Amounts should sum to exactly -100
    const sum = result.reduce((s, r) => s + Math.round(r.amount * 100), 0) / 100
    expect(sum).toBe(-100)
  })

  it('penny allocation: largest absorbs remainder', () => {
    const allocations = [
      { propertyId: 'p1', percentage: 60 },
      { propertyId: 'p2', percentage: 40 },
    ]
    const result = applySplit(-99.99, allocations, propertyLookup)

    // 60% of -99.99 = -59.994 → floor -59.99
    // 40% of -99.99 = -39.996 → floor -39.99
    // Sum = -99.98, remainder = -0.01, largest (60%) absorbs it
    const sum = result.reduce((s, r) => s + Math.round(r.amount * 100), 0) / 100
    expect(sum).toBe(-99.99)
  })

  it('sets taxDeductible based on taxSchedule', () => {
    const allocations = [
      { propertyId: 'p1', percentage: 25 }, // SCHEDULE_A → not deductible
      { propertyId: 'p2', percentage: 25 }, // SCHEDULE_E → deductible
      { propertyId: 'p3', percentage: 25 }, // SCHEDULE_E → deductible
      { propertyId: 'p4', percentage: 25 }, // SCHEDULE_C → deductible
    ]
    const result = applySplit(-400, allocations, propertyLookup)

    expect(result[0].taxDeductible).toBe(false)  // SCHEDULE_A
    expect(result[1].taxDeductible).toBe(true)   // SCHEDULE_E
    expect(result[2].taxDeductible).toBe(true)   // SCHEDULE_E
    expect(result[3].taxDeductible).toBe(true)   // SCHEDULE_C
  })

  it('handles unknown property gracefully', () => {
    const allocations = [{ propertyId: 'unknown', percentage: 100 }]
    const result = applySplit(-50, allocations, propertyLookup)

    expect(result[0].propertyName).toBe('Unknown')
    expect(result[0].taxSchedule).toBeNull()
    expect(result[0].taxDeductible).toBe(false)
  })

  it('returns empty array for empty allocations', () => {
    const result = applySplit(-100, [], propertyLookup)
    expect(result).toHaveLength(0)
  })

  it('handles positive amounts (income)', () => {
    const allocations = [
      { propertyId: 'p1', percentage: 50 },
      { propertyId: 'p2', percentage: 50 },
    ]
    const result = applySplit(2000, allocations, propertyLookup)

    expect(result[0].amount).toBe(1000)
    expect(result[1].amount).toBe(1000)
  })

  it('handles zero amount', () => {
    const allocations = [
      { propertyId: 'p1', percentage: 50 },
      { propertyId: 'p2', percentage: 50 },
    ]
    const result = applySplit(0, allocations, propertyLookup)
    expect(result[0].amount).toBe(0)
    expect(result[1].amount).toBe(0)
  })
})

// ─── batchMatchAndSplit ──────────────────────────────────────────────────────

describe('batchMatchAndSplit', () => {
  const propertyLookup = new Map<string, PropertyInfo>([
    ['p1', { name: 'Home', taxSchedule: 'SCHEDULE_A' }],
    ['p2', { name: 'Rental', taxSchedule: 'SCHEDULE_E' }],
  ])

  const rules: SplitRuleData[] = [
    {
      id: 'r1',
      matchField: 'merchant',
      matchPattern: 'Mortgage Co',
      allocations: [
        { propertyId: 'p1', percentage: 60 },
        { propertyId: 'p2', percentage: 40 },
      ],
      isActive: true,
    },
    {
      id: 'r2',
      matchField: 'category',
      matchPattern: 'Insurance',
      allocations: [
        { propertyId: 'p1', percentage: 50 },
        { propertyId: 'p2', percentage: 50 },
      ],
      isActive: true,
    },
  ]

  it('matches multiple transactions against rules', () => {
    const transactions = [
      { id: 't1', merchant: 'Mortgage Co Payment', amount: -2000, description: 'Monthly' },
      { id: 't2', merchant: 'Grocery Store', amount: -150, categoryName: 'Groceries' },
      { id: 't3', merchant: 'State Farm', amount: -200, categoryName: 'Home Insurance' },
    ]

    const results = batchMatchAndSplit(transactions, rules, propertyLookup)

    expect(results).toHaveLength(2) // t1 matches r1, t3 matches r2
    expect(results[0].transactionId).toBe('t1')
    expect(results[0].matchedRuleId).toBe('r1')
    expect(results[1].transactionId).toBe('t3')
    expect(results[1].matchedRuleId).toBe('r2')
  })

  it('returns only matched transactions', () => {
    const transactions = [
      { id: 't1', merchant: 'No Match', amount: -50 },
      { id: 't2', merchant: 'Also No Match', amount: -30 },
    ]

    const results = batchMatchAndSplit(transactions, rules, propertyLookup)
    expect(results).toHaveLength(0)
  })

  it('preserves original amount in result', () => {
    const transactions = [
      { id: 't1', merchant: 'Mortgage Co', amount: -1500 },
    ]

    const results = batchMatchAndSplit(transactions, rules, propertyLookup)
    expect(results[0].originalAmount).toBe(-1500)
  })

  it('computes correct allocations in batch', () => {
    const transactions = [
      { id: 't1', merchant: 'Mortgage Co', amount: -1000 },
    ]

    const results = batchMatchAndSplit(transactions, rules, propertyLookup)
    expect(results[0].allocations).toHaveLength(2)
    expect(results[0].allocations[0].amount).toBe(-600)  // 60%
    expect(results[0].allocations[1].amount).toBe(-400)  // 40%
  })

  it('handles empty transaction list', () => {
    const results = batchMatchAndSplit([], rules, propertyLookup)
    expect(results).toHaveLength(0)
  })

  it('handles empty rules list', () => {
    const transactions = [
      { id: 't1', merchant: 'Mortgage Co', amount: -1000 },
    ]
    const results = batchMatchAndSplit(transactions, [], propertyLookup)
    expect(results).toHaveLength(0)
  })
})
