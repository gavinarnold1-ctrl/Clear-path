/**
 * Credit Card Intelligence — auto-detect CC payment behavior and interest charges.
 *
 * Analyzes 6 months of transaction history to classify credit card usage patterns:
 *   - pays_in_full: No interest charges, payments match monthly spend
 *   - revolving: Interest charges in 4+ of last 6 months
 *   - mixed: Interest charges in 1-3 of last 6 months
 *   - insufficient_data: Less than 2 months of history
 */

import { db } from '@/lib/db'

// Interest charge merchant patterns (case-insensitive)
const INTEREST_PATTERNS = [
  'interest charge',
  'finance charge',
  'interest chg',
  'minimum interest',
  'purchase interest',
  'cash adv interest',
  'interest on purchases',
  'periodic interest',
]

/**
 * Detect interest charge transactions on a credit card account.
 * Returns matched transactions and links them to the debt.
 */
async function detectInterestCharges(debtId: string, accountId: string) {
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const transactions = await db.transaction.findMany({
    where: {
      accountId,
      date: { gte: sixMonthsAgo },
    },
    include: { category: true },
    orderBy: { date: 'desc' },
  })

  const interestTxns = transactions.filter((tx) => {
    // Check category name
    if (tx.category?.name?.toLowerCase().includes('interest')) return true

    // Check merchant/originalStatement against known patterns
    const statement = (tx.originalStatement || '').toLowerCase()
    const merchant = (tx.merchant || '').toLowerCase()
    return INTEREST_PATTERNS.some(
      (p) => statement.includes(p) || merchant.includes(p),
    )
  })

  // Link interest transactions to the debt
  if (interestTxns.length > 0) {
    await db.transaction.updateMany({
      where: { id: { in: interestTxns.map((t) => t.id) } },
      data: { debtId },
    })
  }

  return { interestTxns, allTransactions: transactions }
}

/**
 * Group transactions by month (YYYY-MM) and return month keys sorted chronologically.
 */
function groupByMonth(
  transactions: { date: Date; amount: number }[],
): Map<string, { debits: number; credits: number; interestCount: number }> {
  const months = new Map<
    string,
    { debits: number; credits: number; interestCount: number }
  >()

  for (const tx of transactions) {
    const key = `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, '0')}`
    const entry = months.get(key) ?? { debits: 0, credits: 0, interestCount: 0 }
    if (tx.amount < 0) {
      entry.debits += Math.abs(tx.amount) // spending (negative = expense)
    } else {
      entry.credits += tx.amount // payments/credits (positive)
    }
    months.set(key, entry)
  }

  return months
}

/**
 * Classify credit card payment behavior based on transaction history.
 */
function classifyBehavior(
  monthlyData: Map<
    string,
    { debits: number; credits: number; interestCount: number }
  >,
  interestMonths: Set<string>,
): {
  behavior: string
  monthsCarried: number
} {
  const months = Array.from(monthlyData.keys()).sort()

  if (months.length < 2) {
    return { behavior: 'insufficient_data', monthsCarried: 0 }
  }

  const interestMonthCount = interestMonths.size

  // Count consecutive recent months with interest (from most recent backward)
  let monthsCarried = 0
  for (let i = months.length - 1; i >= 0; i--) {
    if (interestMonths.has(months[i])) {
      monthsCarried++
    } else {
      break
    }
  }

  if (interestMonthCount === 0) {
    return { behavior: 'pays_in_full', monthsCarried: 0 }
  }
  if (interestMonthCount >= 4) {
    return { behavior: 'revolving', monthsCarried }
  }
  return { behavior: 'mixed', monthsCarried }
}

/**
 * Compute observed APR from interest charge transactions.
 * Returns null if insufficient data or result seems unreasonable.
 */
function computeObservedAPR(
  interestTxns: { amount: number; date: Date }[],
  currentBalance: number,
): number | null {
  if (interestTxns.length < 2 || currentBalance <= 0) return null

  // Use average interest charge to estimate monthly rate
  const avgInterest =
    interestTxns.reduce((sum, tx) => sum + Math.abs(tx.amount), 0) /
    interestTxns.length

  const monthlyRate = avgInterest / currentBalance
  const apr = monthlyRate * 12

  // Sanity check: APR should be between 5% and 40%
  if (apr < 0.05 || apr > 0.40) return null

  return Math.round(apr * 10000) / 10000
}

/**
 * Analyze all credit card debts for a user.
 * Updates each CC debt with behavior classification and observed interest rate.
 */
export async function analyzeAllCreditCards(userId: string): Promise<void> {
  const ccDebts = await db.debt.findMany({
    where: { userId, type: 'CREDIT_CARD' },
  })

  for (const debt of ccDebts) {
    if (!debt.accountId) continue

    try {
      const { interestTxns, allTransactions } = await detectInterestCharges(
        debt.id,
        debt.accountId,
      )

      // Build monthly data
      const monthlyData = groupByMonth(allTransactions)

      // Mark months that had interest charges
      const interestMonths = new Set<string>()
      for (const tx of interestTxns) {
        const key = `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, '0')}`
        interestMonths.add(key)
      }

      // Add interest counts to monthly data
      for (const key of interestMonths) {
        const entry = monthlyData.get(key)
        if (entry) entry.interestCount++
      }

      const { behavior, monthsCarried } = classifyBehavior(
        monthlyData,
        interestMonths,
      )

      // Compute average monthly spend
      const months = Array.from(monthlyData.values())
      const avgMonthlySpend =
        months.length > 0
          ? months.reduce((sum, m) => sum + m.debits, 0) / months.length
          : 0

      // Compute observed APR for revolving/mixed cards
      const observedInterestRate =
        behavior === 'revolving' || behavior === 'mixed'
          ? computeObservedAPR(interestTxns, debt.currentBalance)
          : null

      await db.debt.update({
        where: { id: debt.id },
        data: {
          ccBehavior: behavior,
          observedInterestRate,
          ccLastAnalyzed: new Date(),
          avgMonthlySpend: Math.round(avgMonthlySpend * 100) / 100,
          monthsCarried,
        },
      })
    } catch {
      // Continue with next card on error
    }
  }
}
