/**
 * Split engine — pure math and matching logic, no database or framework imports.
 *
 * Matches transactions against split rules and computes per-property allocations.
 * Used by the backfill API and real-time transaction processing.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SplitAllocation {
  propertyId: string
  propertyName: string
  percentage: number       // 0-100
  amount: number           // Calculated: transaction amount × percentage / 100
  taxSchedule: string | null
  taxDeductible: boolean
}

export interface SplitResult {
  transactionId: string
  originalAmount: number
  allocations: SplitAllocation[]
  matchedRuleId: string | null
}

export interface SplitRuleData {
  id: string
  matchField: string       // "merchant" | "category" | "description"
  matchPattern: string
  allocations: Array<{ propertyId: string; percentage: number }>
  isActive: boolean
}

export interface PropertyInfo {
  name: string
  taxSchedule: string | null
}

// ─── Matching ────────────────────────────────────────────────────────────────

/**
 * Match a transaction against split rules.
 * Checks merchant, category name, or description based on rule's matchField.
 * Case-insensitive partial match (contains).
 * Returns first matching active rule, or null.
 */
export function matchSplitRule(
  transaction: { merchant: string; description?: string | null; categoryName?: string },
  rules: SplitRuleData[]
): SplitRuleData | null {
  for (const rule of rules) {
    if (!rule.isActive) continue

    const pattern = rule.matchPattern.toLowerCase()
    let value = ''

    switch (rule.matchField) {
      case 'merchant':
        value = (transaction.merchant || '').toLowerCase()
        break
      case 'category':
        value = (transaction.categoryName || '').toLowerCase()
        break
      case 'description':
        value = (transaction.description || '').toLowerCase()
        break
      default:
        continue
    }

    if (value.includes(pattern)) {
      return rule
    }
  }
  return null
}

// ─── Splitting ───────────────────────────────────────────────────────────────

/**
 * Apply a split rule to a transaction amount.
 * CRITICAL: Rounding rule — largest allocation absorbs remainder.
 * Ensures all allocations sum exactly to the original amount (penny-perfect).
 */
export function applySplit(
  amount: number,
  allocations: Array<{ propertyId: string; percentage: number }>,
  propertyLookup: Map<string, PropertyInfo>
): SplitAllocation[] {
  if (allocations.length === 0) return []

  // Calculate raw amounts (floor to 2 decimal places)
  const results: SplitAllocation[] = allocations.map((alloc) => {
    const rawAmount = (amount * alloc.percentage) / 100
    const info = propertyLookup.get(alloc.propertyId)
    return {
      propertyId: alloc.propertyId,
      propertyName: info?.name ?? 'Unknown',
      percentage: alloc.percentage,
      amount: Math.floor(rawAmount * 100) / 100,
      taxSchedule: info?.taxSchedule ?? null,
      taxDeductible: info?.taxSchedule === 'SCHEDULE_E' || info?.taxSchedule === 'SCHEDULE_C',
    }
  })

  // Calculate remainder and assign to the largest allocation
  const currentSum = results.reduce((sum, r) => sum + Math.round(r.amount * 100), 0)
  const targetSum = Math.round(amount * 100)
  const remainder = targetSum - currentSum

  if (remainder !== 0) {
    // Find the allocation with the largest percentage to absorb the remainder
    let largestIdx = 0
    for (let i = 1; i < results.length; i++) {
      if (results[i].percentage > results[largestIdx].percentage) {
        largestIdx = i
      }
    }
    results[largestIdx].amount = Math.round((results[largestIdx].amount * 100 + remainder)) / 100
  }

  return results
}

// ─── Batch Processing ────────────────────────────────────────────────────────

/**
 * Process a batch of transactions against all split rules for a user.
 * Used for the "Backfill" feature — runs rules against historical transactions.
 * Returns results only for transactions that matched a rule.
 */
export function batchMatchAndSplit(
  transactions: Array<{
    id: string
    merchant: string
    amount: number
    description?: string | null
    categoryName?: string
  }>,
  rules: SplitRuleData[],
  propertyLookup: Map<string, PropertyInfo>
): SplitResult[] {
  const results: SplitResult[] = []

  for (const tx of transactions) {
    const matchedRule = matchSplitRule(tx, rules)
    if (!matchedRule) continue

    const allocations = applySplit(tx.amount, matchedRule.allocations, propertyLookup)
    results.push({
      transactionId: tx.id,
      originalAmount: tx.amount,
      allocations,
      matchedRuleId: matchedRule.id,
    })
  }

  return results
}
