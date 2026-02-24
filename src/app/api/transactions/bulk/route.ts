import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { transactionIds, updates } = body as {
    transactionIds: string[]
    updates: {
      categoryId?: string | null
      accountId?: string | null
      merchant?: string
    }
  }

  if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
    return NextResponse.json({ error: 'No transaction IDs provided' }, { status: 400 })
  }

  if (!updates || typeof updates !== 'object') {
    return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
  }

  // Verify all transactions belong to the current user
  const owned = await db.transaction.findMany({
    where: { id: { in: transactionIds }, userId: session.userId },
    select: { id: true, categoryId: true, accountId: true, amount: true },
  })

  if (owned.length !== transactionIds.length) {
    return NextResponse.json({ error: 'Some transactions not found' }, { status: 404 })
  }

  // Verify ownership of new accountId if provided
  if (updates.accountId !== undefined && updates.accountId !== null) {
    const account = await db.account.findFirst({
      where: { id: updates.accountId, userId: session.userId },
    })
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  // Verify ownership of new categoryId if provided
  if (updates.categoryId !== undefined && updates.categoryId !== null) {
    const category = await db.category.findFirst({
      where: { id: updates.categoryId, OR: [{ userId: session.userId }, { userId: null, isDefault: true }] },
    })
    if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 })
  }

  // Build the data object for updateMany — only include fields the user opted in to
  const data: Record<string, unknown> = {}
  if (updates.categoryId !== undefined) data.categoryId = updates.categoryId
  if (updates.accountId !== undefined) data.accountId = updates.accountId
  if (updates.merchant !== undefined) data.merchant = updates.merchant

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  // If changing accounts, we need to reverse old balances and apply new ones per-transaction.
  // For category and merchant changes, updateMany is sufficient.
  if (updates.accountId !== undefined) {
    await db.$transaction(async (tx) => {
      // Reverse balances on old accounts
      for (const t of owned) {
        if (t.accountId) {
          await tx.account.update({
            where: { id: t.accountId },
            data: { balance: { decrement: t.amount } },
          })
        }
      }

      // Apply bulk update
      await tx.transaction.updateMany({
        where: { id: { in: transactionIds } },
        data,
      })

      // Apply balances on new account
      if (updates.accountId) {
        for (const t of owned) {
          await tx.account.update({
            where: { id: updates.accountId! },
            data: { balance: { increment: t.amount } },
          })
        }
      }
    })
  } else {
    await db.transaction.updateMany({
      where: { id: { in: transactionIds }, userId: session.userId },
      data,
    })
  }

  return NextResponse.json({ updated: owned.length })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { transactionIds } = body as { transactionIds: string[] }

  if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
    return NextResponse.json({ error: 'No transaction IDs provided' }, { status: 400 })
  }

  // Fetch all transactions to verify ownership and gather data for reversal
  const owned = await db.transaction.findMany({
    where: { id: { in: transactionIds }, userId: session.userId },
    select: { id: true, categoryId: true, accountId: true, amount: true },
  })

  if (owned.length !== transactionIds.length) {
    return NextResponse.json({ error: 'Some transactions not found' }, { status: 404 })
  }

  await db.$transaction(async (tx) => {
    // Delete all transactions
    await tx.transaction.deleteMany({
      where: { id: { in: transactionIds }, userId: session.userId },
    })

    // Reverse account balances
    for (const t of owned) {
      if (t.accountId) {
        await tx.account.update({
          where: { id: t.accountId },
          data: { balance: { decrement: t.amount } },
        })
      }
    }
  })

  return NextResponse.json({ deleted: owned.length })
}
