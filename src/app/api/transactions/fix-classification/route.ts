import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'

/**
 * POST /api/transactions/fix-classification
 * Repairs classification for all user transactions based on amount sign
 * (the source of truth). Category type is only used for transfer detection.
 */
export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.userId

  // Load all transactions with their categories
  const transactions = await db.transaction.findMany({
    where: { userId },
    select: { id: true, amount: true, classification: true, category: { select: { type: true } } },
  })

  let fixed = 0

  for (const tx of transactions) {
    let correct: string
    if (tx.category?.type === 'transfer') {
      correct = 'transfer'
    } else if (tx.amount > 0) {
      correct = 'income'
    } else {
      correct = 'expense'
    }

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
