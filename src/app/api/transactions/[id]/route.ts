import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const transaction = await db.transaction.findUnique({
    where: { id, userId: session.userId },
    include: { account: true, category: true, householdMember: true, property: true },
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

  const oldAccountId = existing.accountId
  const oldAmount = existing.amount

  // Verify ownership of referenced accountId and categoryId
  if (body.accountId !== undefined && body.accountId !== null) {
    const account = await db.account.findFirst({
      where: { id: body.accountId, userId: session.userId },
    })
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }
  const resolvedCategoryId = body.categoryId !== undefined ? body.categoryId : existing.categoryId
  if (resolvedCategoryId) {
    const category = await db.category.findFirst({
      where: { id: resolvedCategoryId, OR: [{ userId: session.userId }, { userId: null, isDefault: true }] },
    })
    if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 })
  }

  // Correct amount sign based on category type — must match server action behavior.
  let finalAmount = body.amount
  if (finalAmount !== undefined && resolvedCategoryId) {
    const category = await db.category.findFirst({
      where: { id: resolvedCategoryId, OR: [{ userId: session.userId }, { userId: null, isDefault: true }] },
    })
    if (category) {
      if (category.type === 'expense') finalAmount = -Math.abs(finalAmount)
      else if (category.type === 'income') finalAmount = Math.abs(finalAmount)
    }
  }

  // Verify ownership of referenced householdMemberId
  if (body.householdMemberId !== undefined && body.householdMemberId !== null) {
    const member = await db.householdMember.findFirst({
      where: { id: body.householdMemberId, userId: session.userId },
    })
    if (!member) return NextResponse.json({ error: 'Household member not found' }, { status: 404 })
  }

  // Verify ownership of referenced propertyId
  if (body.propertyId !== undefined && body.propertyId !== null) {
    const property = await db.property.findFirst({
      where: { id: body.propertyId, userId: session.userId },
    })
    if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 })
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
        ...(body.householdMemberId !== undefined && { householdMemberId: body.householdMemberId }),
        ...(body.propertyId !== undefined && { propertyId: body.propertyId }),
        ...(body.classification !== undefined && { classification: body.classification }),
      },
      include: { account: true, category: true, householdMember: true, property: true },
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

  return new NextResponse(null, { status: 204 })
}
