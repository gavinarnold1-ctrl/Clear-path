/**
 * T1.4 — AI Insights with corrected data (Phase 1, Step 4)
 *
 * Verifies that the AI insights pipeline uses corrected budget data:
 * - buildBudgetContext computes spent from transactions (not stored field)
 * - generateAndStoreInsights passes budget context to AI
 * - Budget context includes over/under budget categories based on computed spent
 * - Unbudgeted spending is correctly identified
 * - Error handling is graceful
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'

// ─── T1.4.1: Budget context feeds correct data to insights ─────────────────

describe('T1.4 — Budget context: corrected data flows to AI insights', () => {
  it('budget-context.ts computes spent from transactions, not stored field', () => {
    const ctxPath = path.resolve(__dirname, '../../src/lib/budget-context.ts')
    const code = fs.readFileSync(ctxPath, 'utf-8')

    // Must query transactions in current month
    expect(code).toMatch(/transaction\.findMany/)
    expect(code).toMatch(/amount:\s*\{\s*lt:\s*0\s*\}/)

    // Must build spentByCategory from transactions
    expect(code).toMatch(/spentByCategory/)
    expect(code).toMatch(/Math\.abs\(tx\.amount\)/)

    // Must enrich budgets with computed spent
    expect(code).toMatch(/budgetsWithSpent/)
    expect(code).toMatch(/spentByCategory\.get\(b\.categoryId\)/)
  })

  it('insights.ts calls buildBudgetContext as part of data pipeline', () => {
    const insightsPath = path.resolve(__dirname, '../../src/lib/insights.ts')
    const code = fs.readFileSync(insightsPath, 'utf-8')

    // Must import and use buildBudgetContext
    expect(code).toMatch(/import.*buildBudgetContext.*from/)
    expect(code).toMatch(/buildBudgetContext\(userId\)/)

    // Must pass budget to generateInsights
    expect(code).toMatch(/budget/)
    expect(code).toMatch(/generateInsights\(\{/)
  })

  it('ai.ts prompt references budget categories and unbudgeted spending', () => {
    const aiPath = path.resolve(__dirname, '../../src/lib/ai.ts')
    const code = fs.readFileSync(aiPath, 'utf-8')

    // Prompt should reference budget awareness
    expect(code).toMatch(/over.*budget|under.*budget|unbudgeted/i)
    expect(code).toMatch(/BUDGET AWARENESS|budget.*categor/i)
  })
})

// ─── T1.4.2: buildBudgetContext unit tests with mocked DB ───────────────────

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

describe('T1.4 — buildBudgetContext: accurate budget data for AI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('over-budget categories reflect computed spent, not stored spent', async () => {
    mockBudgetFindMany.mockResolvedValue([
      {
        id: 'b1',
        name: 'Groceries',
        amount: 300,
        tier: 'FLEXIBLE',
        categoryId: 'cat-g',
        category: { name: 'Groceries' },
        annualExpense: null,
      },
    ])

    // Real transaction data: spent $350, over budget by $50
    mockTransactionFindMany.mockResolvedValue([
      { categoryId: 'cat-g', amount: -200, category: { name: 'Groceries' } },
      { categoryId: 'cat-g', amount: -150, category: { name: 'Groceries' } },
    ])

    const ctx = await buildBudgetContext('user-1')

    expect(ctx.overBudgetCategories).toHaveLength(1)
    expect(ctx.overBudgetCategories[0].name).toBe('Groceries')
    expect(ctx.overBudgetCategories[0].spent).toBe(350)
    expect(ctx.overBudgetCategories[0].overBy).toBe(50)
    expect(ctx.overBudgetCategories[0].budgeted).toBe(300)
  })

  it('under-utilized categories reflect computed spent', async () => {
    mockBudgetFindMany.mockResolvedValue([
      {
        id: 'b1',
        name: 'Entertainment',
        amount: 200,
        tier: 'FLEXIBLE',
        categoryId: 'cat-e',
        category: { name: 'Entertainment' },
        annualExpense: null,
      },
    ])

    // Only $20 spent out of $200 budget = 10% utilized
    mockTransactionFindMany.mockResolvedValue([
      { categoryId: 'cat-e', amount: -20, category: { name: 'Entertainment' } },
    ])

    const ctx = await buildBudgetContext('user-1')

    expect(ctx.underUtilizedCategories).toHaveLength(1)
    expect(ctx.underUtilizedCategories[0].name).toBe('Entertainment')
    expect(ctx.underUtilizedCategories[0].pctUsed).toBe(10)
  })

  it('unbudgeted spending computed from transactions in categories with no budget', async () => {
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
      { categoryId: 'cat-shopping', amount: -150, category: { name: 'Shopping' } },
      { categoryId: 'cat-gas', amount: -40, category: { name: 'Gas' } },
    ])

    const ctx = await buildBudgetContext('user-1')

    // Shopping ($150) + Gas ($40) = $190 unbudgeted
    expect(ctx.unbudgetedSpending).toBe(190)
  })

  it('fixed bills isPaid correctly computed from transactions', async () => {
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
        name: 'Insurance',
        amount: 150,
        tier: 'FIXED',
        categoryId: 'cat-ins',
        category: { name: 'Insurance' },
        annualExpense: null,
      },
    ])

    mockTransactionFindMany.mockResolvedValue([
      { categoryId: 'cat-mortgage', amount: -1500, category: { name: 'Mortgage' } },
      // No insurance payment
    ])

    const ctx = await buildBudgetContext('user-1')

    const mortgage = ctx.fixedBills.find((b) => b.name === 'Mortgage')
    const insurance = ctx.fixedBills.find((b) => b.name === 'Insurance')

    expect(mortgage?.isPaid).toBe(true)
    expect(insurance?.isPaid).toBe(false)
  })

  it('annual expenses data is included in context', async () => {
    const dueMonth = 6
    const dueYear = 2027

    mockBudgetFindMany.mockResolvedValue([
      {
        id: 'b1',
        name: 'Vacation',
        amount: 200,
        tier: 'ANNUAL',
        categoryId: 'cat-v',
        category: { name: 'Vacation' },
        annualExpense: {
          id: 'ae1',
          name: 'Summer Vacation',
          annualAmount: 3600,
          funded: 600,
          dueMonth,
          dueYear,
          monthlySetAside: 200,
        },
      },
    ])

    mockTransactionFindMany.mockResolvedValue([])

    const ctx = await buildBudgetContext('user-1')

    expect(ctx.annualExpenses).toHaveLength(1)
    expect(ctx.annualExpenses[0].name).toBe('Summer Vacation')
    expect(ctx.annualExpenses[0].annualAmount).toBe(3600)
    expect(ctx.annualExpenses[0].funded).toBe(600)
    expect(ctx.annualExpenses[0].monthsLeft).toBeGreaterThan(0)
  })

  it('utilization percent is calculated from computed spent, not stored', async () => {
    mockBudgetFindMany.mockResolvedValue([
      {
        id: 'b1',
        name: 'Food',
        amount: 400,
        tier: 'FLEXIBLE',
        categoryId: 'cat-f',
        category: { name: 'Food' },
        annualExpense: null,
      },
      {
        id: 'b2',
        name: 'Transport',
        amount: 100,
        tier: 'FLEXIBLE',
        categoryId: 'cat-t',
        category: { name: 'Transport' },
        annualExpense: null,
      },
    ])

    mockTransactionFindMany.mockResolvedValue([
      { categoryId: 'cat-f', amount: -200, category: { name: 'Food' } },
      { categoryId: 'cat-t', amount: -80, category: { name: 'Transport' } },
    ])

    const ctx = await buildBudgetContext('user-1')

    // Total budgeted: 400 + 100 = 500
    // Total spent: 200 + 80 = 280
    // Utilization: 280/500 = 56%
    expect(ctx.totalBudgeted).toBe(500)
    expect(ctx.totalSpent).toBe(280)
    expect(ctx.utilizationPercent).toBe(56)
  })
})

// ─── T1.4.3: Error handling in insights API route ───────────────────────────

describe('T1.4 — Insights API: error handling', () => {
  it('api/insights/route.ts returns 500 on generation failure', () => {
    const routePath = path.resolve(__dirname, '../../src/app/api/insights/route.ts')
    const code = fs.readFileSync(routePath, 'utf-8')

    // Must have try/catch with error handling
    expect(code).toMatch(/try\s*\{/)
    expect(code).toMatch(/catch\s*\(/)
    expect(code).toMatch(/status:\s*500/)

    // Must have rate limiting
    expect(code).toMatch(/429/)
  })

  it('api/insights/[id]/route.ts exists for dismiss/complete flow', () => {
    const routePath = path.resolve(__dirname, '../../src/app/api/insights/[id]/route.ts')
    expect(fs.existsSync(routePath)).toBe(true)

    const code = fs.readFileSync(routePath, 'utf-8')
    // Must have PATCH handler for dismiss/complete
    expect(code).toMatch(/PATCH/)
  })
})

// ─── T1.4.4: generateAndStoreInsights pipeline ─────────────────────────────

describe('T1.4 — generateAndStoreInsights: pipeline verification', () => {
  it('insights.ts generateAndStoreInsights calls all 5 data sources', () => {
    const insightsPath = path.resolve(__dirname, '../../src/lib/insights.ts')
    const code = fs.readFileSync(insightsPath, 'utf-8')

    // Must call all 5 data gathering functions
    expect(code).toMatch(/buildTransactionSummary/)
    expect(code).toMatch(/buildTemporalContext/)
    expect(code).toMatch(/getSpendingVelocity/)
    expect(code).toMatch(/buildBudgetContext/)
    expect(code).toMatch(/buildInsightHistory/)

    // Must pass gathered data to generateInsights
    expect(code).toMatch(/generateInsights\(\{/)
  })

  it('insights.ts dismisses old insights before storing new ones', () => {
    const insightsPath = path.resolve(__dirname, '../../src/lib/insights.ts')
    const code = fs.readFileSync(insightsPath, 'utf-8')

    // Must dismiss old active insights
    expect(code).toMatch(/insight\.updateMany/)
    expect(code).toMatch(/status:\s*['"]dismissed['"]/)
    expect(code).toMatch(/auto_replaced/)
  })

  it('insights.ts stores efficiency score with upsert', () => {
    const insightsPath = path.resolve(__dirname, '../../src/lib/insights.ts')
    const code = fs.readFileSync(insightsPath, 'utf-8')

    // Must upsert efficiency score
    expect(code).toMatch(/efficiencyScore\.upsert/)
    expect(code).toMatch(/overallScore/)
    expect(code).toMatch(/spendingScore/)
    expect(code).toMatch(/savingsScore/)
    expect(code).toMatch(/debtScore/)
  })
})
