/**
 * Bug 3 regression tests: Miscellaneous/Other category in Flexible spending
 *
 * Verifies that:
 * - Budget tier aggregation is tier-based, not category-group-based
 * - "Other" / "Miscellaneous" categories with FLEXIBLE tier are included in flexible totals
 * - Adding/removing a Miscellaneous budget changes the flexible total correctly
 * - No hardcoded category lists exclude "Other" from flexible spending
 */
import { describe, it, expect } from 'vitest'
import { calculateTierSummary } from '@/lib/budget-engine'

describe('Bug 3: Miscellaneous/Other in Flexible Spending', () => {
  it('should include a Miscellaneous budget with FLEXIBLE tier in flexible totals', () => {
    const budgets = [
      { tier: 'FLEXIBLE' as const, amount: 640, spent: 500, annualExpense: null },  // Groceries
      { tier: 'FLEXIBLE' as const, amount: 600, spent: 450, annualExpense: null },  // Dining
      { tier: 'FLEXIBLE' as const, amount: 200, spent: 150, annualExpense: null },  // Miscellaneous (Other group)
    ]

    const summary = calculateTierSummary(budgets)

    // Miscellaneous ($200) should be included in the $1,440 total
    expect(summary.flexible.budgeted).toBe(1440)
    expect(summary.flexible.spent).toBe(1100)
    expect(summary.flexible.remaining).toBe(340)
  })

  it('should correctly compute flexible total matching the bug report values', () => {
    // Exact values from the bug report table
    const budgets = [
      { tier: 'FLEXIBLE' as const, amount: 640, spent: 0, annualExpense: null },   // Groceries
      { tier: 'FLEXIBLE' as const, amount: 600, spent: 0, annualExpense: null },   // Restaurants & Dining
      { tier: 'FLEXIBLE' as const, amount: 220, spent: 0, annualExpense: null },   // Gas & Fuel
      { tier: 'FLEXIBLE' as const, amount: 200, spent: 0, annualExpense: null },   // Shopping & Personal
      { tier: 'FLEXIBLE' as const, amount: 330, spent: 0, annualExpense: null },   // Pets & Pet Care
      { tier: 'FLEXIBLE' as const, amount: 320, spent: 0, annualExpense: null },   // Entertainment & Recreation
      { tier: 'FLEXIBLE' as const, amount: 80, spent: 0, annualExpense: null },    // Uber & Ride Shares
      { tier: 'FLEXIBLE' as const, amount: 200, spent: 0, annualExpense: null },   // Miscellaneous
    ]

    const summary = calculateTierSummary(budgets)
    expect(summary.flexible.budgeted).toBe(2590) // Should match the bug report sum
  })

  it('should NOT include FIXED or ANNUAL budgets in flexible totals', () => {
    const budgets = [
      { tier: 'FIXED' as const, amount: 3640, spent: 3640, annualExpense: null },
      { tier: 'FLEXIBLE' as const, amount: 200, spent: 150, annualExpense: null },
      { tier: 'ANNUAL' as const, amount: 0, spent: 0, annualExpense: { monthlySetAside: 100, annualAmount: 1200, funded: 400 } },
    ]

    const summary = calculateTierSummary(budgets)
    expect(summary.flexible.budgeted).toBe(200)
    expect(summary.fixed.total).toBe(3640)
    expect(summary.annual.monthlySetAside).toBe(100)
  })

  it('should change flexible total when adding a Miscellaneous budget', () => {
    const baseBudgets = [
      { tier: 'FLEXIBLE' as const, amount: 640, spent: 500, annualExpense: null },
      { tier: 'FLEXIBLE' as const, amount: 600, spent: 450, annualExpense: null },
    ]

    const before = calculateTierSummary(baseBudgets)

    const withMisc = [
      ...baseBudgets,
      { tier: 'FLEXIBLE' as const, amount: 200, spent: 75, annualExpense: null },
    ]

    const after = calculateTierSummary(withMisc)

    expect(after.flexible.budgeted - before.flexible.budgeted).toBe(200)
    expect(after.flexible.spent - before.flexible.spent).toBe(75)
  })

  it('should handle zero-amount budgets without errors', () => {
    const budgets = [
      { tier: 'FLEXIBLE' as const, amount: 0, spent: 0, annualExpense: null },
    ]

    const summary = calculateTierSummary(budgets)
    expect(summary.flexible.budgeted).toBe(0)
    expect(summary.flexible.remaining).toBe(0)
  })

  it('should track over-budget correctly for Miscellaneous', () => {
    const budgets = [
      { tier: 'FLEXIBLE' as const, amount: 200, spent: 350, annualExpense: null }, // Over by $150
    ]

    const summary = calculateTierSummary(budgets)
    expect(summary.flexible.remaining).toBe(-150)
  })

  it('should compute totalMonthlyObligation including all tiers', () => {
    const budgets = [
      { tier: 'FIXED' as const, amount: 3640, spent: 3640, annualExpense: null },
      { tier: 'FLEXIBLE' as const, amount: 2590, spent: 1800, annualExpense: null },
      { tier: 'ANNUAL' as const, amount: 0, spent: 0, annualExpense: { monthlySetAside: 200, annualAmount: 2400, funded: 1000 } },
    ]

    const summary = calculateTierSummary(budgets)
    expect(summary.totalMonthlyObligation).toBe(3640 + 2590 + 200)
  })

  it('should handle empty budget array', () => {
    const summary = calculateTierSummary([])
    expect(summary.flexible.budgeted).toBe(0)
    expect(summary.flexible.spent).toBe(0)
    expect(summary.fixed.total).toBe(0)
    expect(summary.annual.monthlySetAside).toBe(0)
    expect(summary.totalMonthlyObligation).toBe(0)
  })
})
