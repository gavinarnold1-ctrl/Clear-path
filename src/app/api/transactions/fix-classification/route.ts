import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { classifyTransaction } from '@/lib/category-groups'

/**
 * POST /api/transactions/fix-classification
 * Repairs classification for all user transactions using the group-based
 * hierarchy: category group → category type → amount sign.
 */
export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.userId

  // Load all transactions with their category group + type
  const transactions = await db.transaction.findMany({
    where: { userId },
    select: {
      id: true,
      amount: true,
      classification: true,
      category: { select: { type: true, group: true } },
    },
  })

  let fixed = 0

  for (const tx of transactions) {
    // Perk reimbursement categories bypass the normal classification hierarchy
    const correct = tx.category?.type === 'perk_reimbursement'
      ? 'perk_reimbursement'
      : classifyTransaction(
          tx.category?.group,
          tx.category?.type,
          tx.amount,
        )

    if (tx.classification !== correct) {
      await db.transaction.update({
        where: { id: tx.id },
        data: { classification: correct },
      })
      fixed++
    }
  }

  return NextResponse.json({
    total: transactions.length,
    fixed,
    message: fixed > 0
      ? `Fixed classification on ${fixed} transaction${fixed !== 1 ? 's' : ''}`
      : 'All transactions already have correct classification',
  })
}
