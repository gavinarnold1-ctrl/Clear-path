/**
 * T1.1 — Budget.spent computed correctly (Phase 1, Step 1)
 *
 * Verifies that:
 * 1. Budget model no longer has a `spent` field in schema
 * 2. Spent is computed from current-month transactions on read
 * 3. Budget creation does NOT write to a `spent` field
 * 4. Transaction create/delete does NOT update a budget `spent` field
 * 5. budget-context.ts computes spent from transactions for AI insights
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'

// ─── T1.1.1: Schema verification ──────────────────────────────────────────────

describe('T1.1 — Schema: Budget.spent field removed', () => {
  it('schema.prisma does not contain a spent field on Budget model', () => {
    const schemaPath = path.resolve(__dirname, '../../prisma/schema.prisma')
    const schema = fs.readFileSync(schemaPath, 'utf-8')

    // Extract the Budget model block
    const budgetModelMatch = schema.match(/model Budget \{[\s\S]*?\n\}/)
    expect(budgetModelMatch).not.toBeNull()

    const budgetModel = budgetModelMatch![0]
    // Should NOT contain a "spent" field declaration
    expect(budgetModel).not.toMatch(/\bspent\s+Float/)
    expect(budgetModel).not.toMatch(/\bspent\s+Int/)
    expect(budgetModel).not.toMatch(/\bspent\b/)
  })

  it('types/index.ts Budget interface does not have a spent property', () => {
    const typesPath = path.resolve(__dirname, '../../src/types/index.ts')
    const types = fs.readFileSync(typesPath, 'utf-8')

    // Find the Budget interface/type — should not have spent
    // We look for "spent:" within a reasonable distance of "Budget"
    const budgetSection = types.match(/(?:interface|type)\s+Budget\s*[\{=][\s\S]*?\}/)
    if (budgetSection) {
      expect(budgetSection[0]).not.toMatch(/\bspent\s*:/)
    }
    // If no Budget interface found, that's also fine (might be using Prisma types)
  })
})

// ─── T1.1.2: Spent is computed on read (budget-context.ts) ───────────────────

const mockBudgetFindMany = vi.fn()
const mockTransactionFindMany = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    budget: {
      findMany: (...args: unknown[]) => mockBudgetFindMany(...args),
    },
    transaction: {
      findMany: (...args: unknown[]) => mockTransactionFindMany(...args),
    },
  },
}))

import { buildBudgetContext } from '@/lib/budget-context'

describe('T1.1 — buildBudgetContext computes spent from transactions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns spent based on current-month transactions, not a stored field', async () => {
    const groceriesCatId = 'cat-groceries'
    const restaurantsCatId = 'cat-restaurants'

    mockBudgetFindMany.mockResolvedValue([
      {
        id: 'b1',
        name: 'Groceries',
        amount: 500,
        tier: 'FLEXIBLE',
        categoryId: groceriesCatId,
        category: { name: 'Groceries' },
        annualExpense: null,
      },
      {
        id: 'b2',
        name: 'Restaurants & Bars',
        amount: 300,
        tier: 'FLEXIBLE',
        categoryId: restaurantsCatId,
        category: { name: 'Restaurants & Bars' },
        annualExpense: null,
      },
    ])

    mockTransactionFindMany.mockResolvedValue([
      { categoryId: groceriesCatId, amount: -50.25, category: { name: 'Groceries' } },
      { categoryId: groceriesCatId, amount: -75.00, category: { name: 'Groceries' } },
      { categoryId: groceriesCatId, amount: -86.23, category: { name: 'Groceries' } },
      { categoryId: restaurantsCatId, amount: -45.00, category: { name: 'Restaurants & Bars' } },
      { categoryId: restaurantsCatId, amount: -129.50, category: { name: 'Restaurants & Bars' } },
    ])

    const ctx = await buildBudgetContext('user-1')

    // Groceries: |−50.25| + |−75| + |−86.23| = 211.48
    expect(ctx.totalSpent).toBeCloseTo(211.48 + 174.50, 2)

    // Utilization: (211.48+174.50)/(500+300) = ~48.2%
    expect(ctx.utilizationPercent).toBe(Math.round(((211.48 + 174.50) / 800) * 100))
  })

  it('returns 0 spent for budget with no matching transactions', async () => {
    mockBudgetFindMany.mockResolvedValue([
      {
        id: 'b1',
        name: 'Entertainment',
        amount: 200,
        tier: 'FLEXIBLE',
        categoryId: 'cat-entertainment',
        category: { name: 'Entertainment' },
        annualExpense: null,
      },
    ])

    mockTransactionFindMany.mockResolvedValue([])

    const ctx = await buildBudgetContext('user-1')
    expect(ctx.totalSpent).toBe(0)
    expect(ctx.utilizationPercent).toBe(0)
  })

  it('excludes ANNUAL budgets from totalSpent/totalBudgeted', async () => {
    mockBudgetFindMany.mockResolvedValue([
      {
        id: 'b1',
        name: 'Groceries',
        amount: 500,
        tier: 'FLEXIBLE',
        categoryId: 'cat-g',
        category: { name: 'Groceries' },
        annualExpense: null,
      },
      {
        id: 'b2',
        name: 'Vacation Fund',
        amount: 200,
        tier: 'ANNUAL',
        categoryId: 'cat-v',
        category: { name: 'Vacation' },
        annualExpense: { id: 'ae1', name: 'Vacation', annualAmount: 2400, funded: 0, dueMonth: 6, dueYear: 2027, monthlySetAside: 200 },
      },
    ])

    mockTransactionFindMany.mockResolvedValue([
      { categoryId: 'cat-g', amount: -100, category: { name: 'Groceries' } },
    ])

    const ctx = await buildBudgetContext('user-1')
    expect(ctx.totalBudgeted).toBe(500) // Only FLEXIBLE, not ANNUAL
    expect(ctx.totalSpent).toBe(100) // Only from FLEXIBLE categories
  })

  it('identifies over-budget categories from computed spent', async () => {
    mockBudgetFindMany.mockResolvedValue([
      {
        id: 'b1',
        name: 'Dining',
        amount: 100,
        tier: 'FLEXIBLE',
        categoryId: 'cat-d',
        category: { name: 'Dining' },
        annualExpense: null,
      },
    ])

    mockTransactionFindMany.mockResolvedValue([
      { categoryId: 'cat-d', amount: -60, category: { name: 'Dining' } },
      { categoryId: 'cat-d', amount: -55, category: { name: 'Dining' } },
    ])

    const ctx = await buildBudgetContext('user-1')
    expect(ctx.overBudgetCategories).toHaveLength(1)
    expect(ctx.overBudgetCategories[0].name).toBe('Dining')
    expect(ctx.overBudgetCategories[0].overBy).toBeCloseTo(15, 2)
  })

  it('identifies unbudgeted spending (transactions in categories with no budget)', async () => {
    mockBudgetFindMany.mockResolvedValue([
      {
        id: 'b1',
        name: 'Groceries',
        amount: 500,
        tier: 'FLEXIBLE',
        categoryId: 'cat-g',
        category: { name: 'Groceries' },
        annualExpense: null,
      },
    ])

    mockTransactionFindMany.mockResolvedValue([
      { categoryId: 'cat-g', amount: -100, category: { name: 'Groceries' } },
      { categoryId: 'cat-unbudgeted', amount: -200, category: { name: 'Shopping' } },
      { categoryId: 'cat-unbudgeted', amount: -50, category: { name: 'Shopping' } },
    ])

    const ctx = await buildBudgetContext('user-1')
    expect(ctx.unbudgetedSpending).toBe(250) // 200 + 50 from unbudgeted category
  })

  it('computes fixedBills isPaid from transactions, not stored spent', async () => {
    mockBudgetFindMany.mockResolvedValue([
      {
        id: 'b1',
        name: 'Mortgage',
        amount: 1500,
        tier: 'FIXED',
        categoryId: 'cat-mortgage',
        category: { name: 'Mortgage' },
        annualExpense: null,
      },
      {
        id: 'b2',
        name: 'Internet',
        amount: 75,
        tier: 'FIXED',
        categoryId: 'cat-internet',
        category: { name: 'Internet' },
        annualExpense: null,
      },
    ])

    mockTransactionFindMany.mockResolvedValue([
      { categoryId: 'cat-mortgage', amount: -1500, category: { name: 'Mortgage' } },
      // No internet payment this month
    ])

    const ctx = await buildBudgetContext('user-1')
    expect(ctx.fixedBills).toHaveLength(2)

    const mortgage = ctx.fixedBills.find((b) => b.name === 'Mortgage')
    const internet = ctx.fixedBills.find((b) => b.name === 'Internet')

    expect(mortgage?.isPaid).toBe(true)
    expect(internet?.isPaid).toBe(false)
  })
})

// ─── T1.1.3: Budget creation does not write spent ────────────────────────────

describe('T1.1 — Budget creation does not include spent field', () => {
  it('actions/budgets.ts createBudget does not include spent in data', () => {
    const actionsPath = path.resolve(__dirname, '../../src/app/actions/budgets.ts')
    const code = fs.readFileSync(actionsPath, 'utf-8')

    // Find budget.create calls and verify they don't set spent
    const createCalls = code.match(/budget\.create\(\{[\s\S]*?\}\)/g)
    if (createCalls) {
      for (const call of createCalls) {
        expect(call).not.toMatch(/\bspent\s*:/)
      }
    }
  })

  it('api/budgets/apply/route.ts does not include spent in create data', () => {
    const routePath = path.resolve(__dirname, '../../src/app/api/budgets/apply/route.ts')
    const code = fs.readFileSync(routePath, 'utf-8')

    // The budget apply route should not set spent
    const createCalls = code.match(/budget\.create\(\{[\s\S]*?\}\)/g)
    if (createCalls) {
      for (const call of createCalls) {
        expect(call).not.toMatch(/\bspent\s*:/)
      }
    }
  })
})

// ─── T1.1.4: Transaction mutations don't update budget.spent ─────────────────

describe('T1.1 — Transaction mutations do not update budget.spent', () => {
  it('actions/transactions.ts does not reference budget.update for spent', () => {
    const actionsPath = path.resolve(__dirname, '../../src/app/actions/transactions.ts')
    const code = fs.readFileSync(actionsPath, 'utf-8')

    // Should not contain budget-related updates (no more spent tracking)
    expect(code).not.toMatch(/budget\.update/)
    expect(code).not.toMatch(/budget\.findFirst/)
    expect(code).not.toMatch(/recalculateBudget/)
  })

  it('api/transactions/route.ts does not import recalculate functions', () => {
    const routePath = path.resolve(__dirname, '../../src/app/api/transactions/route.ts')
    const code = fs.readFileSync(routePath, 'utf-8')

    expect(code).not.toMatch(/recalculateBudget/)
  })

  it('api/transactions/[id]/route.ts does not import recalculate functions', () => {
    const routePath = path.resolve(__dirname, '../../src/app/api/transactions/[id]/route.ts')
    const code = fs.readFileSync(routePath, 'utf-8')

    expect(code).not.toMatch(/recalculateBudget/)
  })

  it('api/transactions/bulk/route.ts does not import recalculate functions', () => {
    const routePath = path.resolve(__dirname, '../../src/app/api/transactions/bulk/route.ts')
    const code = fs.readFileSync(routePath, 'utf-8')

    expect(code).not.toMatch(/recalculateBudget/)
  })

  it('budget-utils.ts does not export recalculate functions', () => {
    const utilsPath = path.resolve(__dirname, '../../src/lib/budget-utils.ts')
    const code = fs.readFileSync(utilsPath, 'utf-8')

    expect(code).not.toMatch(/export\s+(?:async\s+)?function\s+recalculate/)
    expect(code).not.toMatch(/getBudgetDateRange/)
  })
})

// ─── T1.1.5: Budgets page computes spent on read ────────────────────────────

describe('T1.1 — Budgets page computes spent on read', () => {
  it('budgets/page.tsx builds spentByCategory from transactions', () => {
    const pagePath = path.resolve(__dirname, '../../src/app/(dashboard)/budgets/page.tsx')
    const code = fs.readFileSync(pagePath, 'utf-8')

    // Must have spentByCategory computation
    expect(code).toMatch(/spentByCategory/)
    expect(code).toMatch(/Math\.abs\(tx\.amount\)/)

    // Must NOT reference b.spent from database
    expect(code).not.toMatch(/b\.spent\b(?!\s*:)/)
  })

  it('dashboard/page.tsx builds budgetSpentMap from transactions', () => {
    const pagePath = path.resolve(__dirname, '../../src/app/(dashboard)/dashboard/page.tsx')
    const code = fs.readFileSync(pagePath, 'utf-8')

    // Must have budgetSpentMap computation
    expect(code).toMatch(/budgetSpentMap|spentByCategory/)
    expect(code).toMatch(/Math\.abs/)
  })
})
