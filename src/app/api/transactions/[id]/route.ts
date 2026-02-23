import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { recalculateBudgetSpentForCategory } from '@/lib/budget-utils'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const transaction = await db.transaction.findUnique({
    where: { id, userId: session.userId },
    include: { account: true, category: true },
  })
  if (!transaction) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(transaction)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  // Verify ownership before update
  const existing = await db.transaction.findUnique({ where: { id, userId: session.userId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const oldCategoryId = existing.categoryId
  const oldAccountId = existing.accountId
  const oldAmount = existing.amount

  // Correct amount sign based on category type — must match server action behavior.
  let finalAmount = body.amount
  const resolvedCategoryId = body.categoryId !== undefined ? body.categoryId : existing.categoryId
  if (finalAmount !== undefined && resolvedCategoryId) {
    const category = await db.category.findUnique({ where: { id: resolvedCategoryId } })
    if (category) {
      if (category.type === 'expense') finalAmount = -Math.abs(finalAmount)
      else if (category.type === 'income') finalAmount = Math.abs(finalAmount)
    }
  }

  const transaction = await db.$transaction(async (tx) => {
    const updated = await tx.transaction.update({
      where: { id },
      data: {
        ...(finalAmount !== undefined && { amount: finalAmount }),
        ...(body.merchant && { merchant: body.merchant }),
        ...(body.date && { date: new Date(body.date) }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.tags !== undefined && { tags: body.tags }),
        ...(body.categoryId !== undefined && { categoryId: body.categoryId }),
        ...(body.accountId !== undefined && { accountId: body.accountId }),
        ...(body.originalStatement !== undefined && { originalStatement: body.originalStatement }),
        ...(body.transactionType !== undefined && { transactionType: body.transactionType }),
      },
      include: { account: true, category: true },
    })

    // Reverse old account balance, apply new
    if (oldAccountId) {
      await tx.account.update({
        where: { id: oldAccountId },
        data: { balance: { decrement: oldAmount } },
      })
    }
    if (updated.accountId) {
      await tx.account.update({
        where: { id: updated.accountId },
        data: { balance: { increment: updated.amount } },
      })
    }

    return updated
  })

  // Recalculate budgets for all affected categories
  const categoriesToRecalc = new Set<string>()
  if (oldCategoryId) categoriesToRecalc.add(oldCategoryId)
  if (transaction.categoryId) categoriesToRecalc.add(transaction.categoryId)
  for (const catId of categoriesToRecalc) {
    await recalculateBudgetSpentForCategory(session.userId, catId)
  }

  return NextResponse.json(transaction)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  // userId in where clause ensures ownership
  const existing = await db.transaction.findUnique({ where: { id, userId: session.userId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.$transaction(async (tx) => {
    await tx.transaction.delete({ where: { id } })

    // Reverse account balance
    if (existing.accountId) {
      await tx.account.update({
        where: { id: existing.accountId },
        data: { balance: { decrement: existing.amount } },
      })
    }
  })

  if (existing.categoryId) {
    await recalculateBudgetSpentForCategory(session.userId, existing.categoryId)
  }

  return new NextResponse(null, { status: 204 })
}
