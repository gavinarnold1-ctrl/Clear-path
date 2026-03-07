import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'

/**
 * POST /api/transactions/merge
 * Merges duplicate transactions — keeps one (the "winner"), deletes the rest.
 * User edits (category, notes, tags, person, property) from deleted records
 * are preserved on the kept record if it lacks them.
 */
export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { keepId, deleteIds } = body as { keepId: string; deleteIds: string[] }

    if (!keepId || !Array.isArray(deleteIds) || deleteIds.length === 0) {
      return NextResponse.json({ error: 'Missing keepId or deleteIds' }, { status: 400 })
    }

    // Verify ownership of all transactions
    const allIds = [keepId, ...deleteIds]
    const txs = await db.transaction.findMany({
      where: { id: { in: allIds }, userId: session.userId },
    })

    if (txs.length !== allIds.length) {
      return NextResponse.json({ error: 'One or more transactions not found' }, { status: 404 })
    }

    const keepTx = txs.find(t => t.id === keepId)!
    const deleteTxs = txs.filter(t => t.id !== keepId)

    // Merge: adopt user edits from deleted transactions into the kept one
    const updates: Record<string, unknown> = {}
    for (const dtx of deleteTxs) {
      if (!keepTx.categoryId && dtx.categoryId) updates.categoryId = dtx.categoryId
      if (!keepTx.notes && dtx.notes) updates.notes = dtx.notes
      if (!keepTx.tags && dtx.tags) updates.tags = dtx.tags
      if (!keepTx.householdMemberId && dtx.householdMemberId) updates.householdMemberId = dtx.householdMemberId
      if (!keepTx.propertyId && dtx.propertyId) updates.propertyId = dtx.propertyId
      if (!keepTx.debtId && dtx.debtId) updates.debtId = dtx.debtId
      if (!keepTx.annualExpenseId && dtx.annualExpenseId) updates.annualExpenseId = dtx.annualExpenseId
      // Prefer Plaid-sourced transaction ID if the kept one doesn't have one
      if (!keepTx.plaidTransactionId && dtx.plaidTransactionId) {
        updates.plaidTransactionId = dtx.plaidTransactionId
        updates.importSource = 'plaid'
      }
    }

    await db.$transaction([
      // Update the kept transaction with merged fields
      ...(Object.keys(updates).length > 0
        ? [db.transaction.update({ where: { id: keepId }, data: updates })]
        : []),
      // Delete the duplicates
      db.transaction.deleteMany({
        where: { id: { in: deleteIds }, userId: session.userId },
      }),
    ])

    revalidatePath('/transactions')
    revalidatePath('/dashboard')

    return NextResponse.json({
      merged: deleteIds.length,
      kept: keepId,
    })
  } catch (error) {
    console.error('Transaction merge failed:', error)
    return NextResponse.json({ error: 'Failed to merge transactions' }, { status: 500 })
  }
}
