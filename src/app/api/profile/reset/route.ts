import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'

/**
 * POST /api/profile/reset
 * Deletes all user data (transactions, budgets, accounts, debts, etc.)
 * but keeps the user account itself so they can start fresh.
 */
export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.userId

  // Delete in dependency order to avoid FK violations.
  // Transactions reference many other tables, so delete first.
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
    // 9. Accounts (references household members)
    db.account.deleteMany({ where: { userId } }),
    // 10. Household members
    db.householdMember.deleteMany({ where: { userId } }),
    // 11. Properties
    db.property.deleteMany({ where: { userId } }),
    // 12. User-created categories (keep system defaults where userId is null)
    db.category.deleteMany({ where: { userId } }),
    // 13. Reset onboarding profile
    db.userProfile.deleteMany({ where: { userId } }),
  ])

  return NextResponse.json({
    success: true,
    message: 'All data has been reset. Your account is intact — you can start fresh.',
  })
}
