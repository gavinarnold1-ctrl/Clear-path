import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { classifyTransaction } from '@/lib/category-groups'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const transaction = await db.transaction.findFirst({
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

  // Verify ownership before update (findFirst enforces userId scoping)
  const existing = await db.transaction.findFirst({ where: { id, userId: session.userId } })
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

  // Correct amount sign and derive classification from category group.
  let finalAmount = body.amount
  let classification: string | undefined
  if (resolvedCategoryId) {
    const category = await db.category.findFirst({
      where: { id: resolvedCategoryId, OR: [{ userId: session.userId }, { userId: null, isDefault: true }] },
    })
    if (category) {
      if (finalAmount !== undefined) {
        if (category.type === 'expense') finalAmount = -Math.abs(finalAmount)
        else if (category.type === 'income') finalAmount = Math.abs(finalAmount)
      }
      const resolvedAmount = finalAmount ?? existing.amount
      classification = classifyTransaction(category.group, category.type, resolvedAmount)
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
        ...(classification !== undefined && { classification }),
        ...(body.merchant && { merchant: body.merchant }),
        ...(body.date && { date: new Date(body.date.includes('T') ? body.date : `${body.date}T12:00:00`) }),
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

  // Smart category learning v2: when a user changes a transaction's category,
  // save the merchant→category mapping with multi-signal context so future imports auto-categorize.
  if (body.categoryId && body.categoryId !== existing.categoryId && transaction.merchant) {
    const normalizedMerchant = transaction.merchant.toLowerCase().trim()
    if (normalizedMerchant) {
      try {
        // Capture direction and amount range for multi-signal matching
        const txAmount = Math.abs(transaction.amount)
        const direction = transaction.amount > 0 ? 'credit' : 'debit'
        const amountMin = Math.round(txAmount * 0.75 * 100) / 100 // 25% below
        const amountMax = Math.round(txAmount * 1.25 * 100) / 100 // 25% above
        // Extract keywords from original statement or notes
        const descParts = [transaction.originalStatement, transaction.notes].filter(Boolean)
        const descKeywords = descParts.length > 0
          ? descParts
              .join(' ')
              .toLowerCase()
              .split(/[\s,;|]+/)
              .filter((w: string) => w.length > 2)
              .slice(0, 5)
              .join(',')
          : null

        // Include property signal in category mapping
        const resolvedPropertyId = body.propertyId !== undefined ? body.propertyId : transaction.propertyId

        await db.userCategoryMapping.upsert({
          where: {
            userId_merchantName_direction_categoryId: {
              userId: session.userId,
              merchantName: normalizedMerchant,
              direction,
              categoryId: body.categoryId,
            },
          },
          create: {
            userId: session.userId,
            merchantName: normalizedMerchant,
            categoryId: body.categoryId,
            confidence: 1.0,
            timesApplied: 0,
            direction,
            amountMin,
            amountMax,
            descKeywords: descKeywords || null,
            propertyId: resolvedPropertyId || null,
          },
          update: {
            categoryId: body.categoryId,
            confidence: 1.0,
            amountMin,
            amountMax,
            descKeywords: descKeywords || undefined,
            propertyId: resolvedPropertyId || undefined,
            updatedAt: new Date(),
          },
        })
      } catch {
        // Non-critical — don't fail the transaction update if mapping save fails
      }
    }
  }

  // Smart property learning: when a user changes a transaction's property (without category change),
  // update any existing mapping with the property signal.
  if (body.propertyId && body.propertyId !== existing.propertyId && transaction.merchant && transaction.categoryId) {
    const normalizedMerchant = transaction.merchant.toLowerCase().trim()
    if (normalizedMerchant) {
      try {
        const direction = transaction.amount > 0 ? 'credit' : 'debit'
        // Update existing mappings for this merchant+category to include the property
        await db.userCategoryMapping.updateMany({
          where: {
            userId: session.userId,
            merchantName: normalizedMerchant,
            direction,
            categoryId: transaction.categoryId,
          },
          data: {
            propertyId: body.propertyId,
            updatedAt: new Date(),
          },
        })
      } catch {
        // Non-critical
      }
    }
  }

  revalidatePath('/dashboard')
  revalidatePath('/transactions')
  revalidatePath('/budgets')
  revalidatePath('/spending')
  return NextResponse.json(transaction)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  // findFirst enforces userId scoping (findUnique ignores non-unique fields)
  const existing = await db.transaction.findFirst({ where: { id, userId: session.userId } })
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

  revalidatePath('/dashboard')
  revalidatePath('/transactions')
  revalidatePath('/budgets')
  revalidatePath('/spending')
  return new NextResponse(null, { status: 204 })
}
