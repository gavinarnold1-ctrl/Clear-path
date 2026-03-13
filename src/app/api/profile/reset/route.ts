import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { seedUserCategories } from '@/lib/seed-categories'

/**
 * POST /api/profile/reset
 * Resets account to "new user" state:
 * 1. Deletes all transactions, budgets, debts, insights, mappings, etc.
 * 2. Preserves Plaid-connected accounts (resets cursors for fresh sync)
 * 3. Re-seeds default categories
 * 4. Returns plaidAccountCount so the client can trigger re-sync
 */
export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.userId

  // Check for Plaid-connected accounts before deletion
  const plaidAccounts = await db.account.findMany({
    where: { userId, plaidItemId: { not: null } },
    select: { id: true, plaidItemId: true },
  })

  // Delete in dependency order to avoid FK violations.
  // Keep Plaid accounts — delete only manual accounts.
  await db.$transaction([
    // 1. Transactions (references categories, accounts, annual expenses, members, properties, debts)
    db.transaction.deleteMany({ where: { userId } }),
    // 2. Insight feedback (references insights)
    db.insightFeedback.deleteMany({ where: { userId } }),
    // 3. Insights
    db.insight.deleteMany({ where: { userId } }),
    // 4. Efficiency scores
    db.efficiencyScore.deleteMany({ where: { userId } }),
    // 5. Monthly snapshots
    db.monthlySnapshot.deleteMany({ where: { userId } }),
    // 6. Annual expenses (references budgets)
    db.annualExpense.deleteMany({ where: { userId } }),
    // 7. Budgets (references categories)
    db.budget.deleteMany({ where: { userId } }),
    // 8. Debts (references properties, categories)
    db.debt.deleteMany({ where: { userId } }),
    // 9. Delete only manual accounts, keep Plaid-connected ones
    db.account.deleteMany({
      where: { userId, plaidItemId: null },
    }),
    // 10. Household members
    db.householdMember.deleteMany({ where: { userId } }),
    // 11. Property groups (cascades to SplitRules and SplitMatchRules)
    db.propertyGroup.deleteMany({ where: { userId } }),
    // 12. Properties (must come after property groups)
    db.property.deleteMany({ where: { userId } }),
    // 13. User category mappings (learned merchant → category)
    db.userCategoryMapping.deleteMany({ where: { userId } }),
    // 14. User-created categories
    db.category.deleteMany({ where: { userId } }),
    // 15. Reset onboarding profile
    db.userProfile.deleteMany({ where: { userId } }),
  ])

  // Reset Plaid cursors and sync timestamps so fresh sync pulls all historical transactions
  // and BackgroundSyncTrigger considers items stale (triggers auto-sync on next dashboard load)
  if (plaidAccounts.length > 0) {
    await db.account.updateMany({
      where: { userId, plaidItemId: { not: null } },
      data: { plaidCursor: null, plaidLastSynced: null, syncFailCount: 0 },
    })
  }

  // Re-seed default categories for fresh start
  await seedUserCategories(userId)

  const plaidAccountCount = plaidAccounts.length

  return NextResponse.json({
    success: true,
    plaidAccountCount,
    message: plaidAccountCount > 0
      ? `Data reset. ${plaidAccountCount} connected bank${plaidAccountCount !== 1 ? 's' : ''} preserved — syncing transactions now...`
      : 'All data has been reset. Your account is intact — you can start fresh.',
  })
}
