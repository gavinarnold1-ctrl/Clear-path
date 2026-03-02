import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { classifyTransaction } from '@/lib/category-groups'
import { applyPropertyAttribution } from '@/lib/apply-splits'
import { createTransactionSchema, validateBody } from '@/lib/validation'
const VALID_CATEGORY_TYPES = new Set(['income', 'expense', 'transfer'])
const VALID_CLASSIFICATIONS = new Set(['expense', 'income', 'transfer'])

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const categoryType = searchParams.get('categoryType') ?? undefined
  const accountId = searchParams.get('accountId') ?? undefined

  if (categoryType && !VALID_CATEGORY_TYPES.has(categoryType)) {
    return NextResponse.json({ error: 'Invalid category type filter' }, { status: 400 })
  }

  const householdMemberId = searchParams.get('householdMemberId') ?? undefined
  const propertyId = searchParams.get('propertyId') ?? undefined
  const classification = searchParams.get('classification') ?? undefined

  if (classification && !VALID_CLASSIFICATIONS.has(classification)) {
    return NextResponse.json({ error: 'Invalid classification filter' }, { status: 400 })
  }

  const transactions = await db.transaction.findMany({
    where: {
      userId: session.userId,
      ...(categoryType && { category: { type: categoryType } }),
      ...(accountId && { accountId }),
      ...(householdMemberId && { householdMemberId }),
      ...(propertyId && { propertyId }),
      ...(classification && { classification }),
    },
    include: { account: true, category: true, householdMember: true, property: true, debt: true },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json(transactions)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = validateBody(createTransactionSchema, body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { accountId, categoryId, amount, merchant, date, notes, tags, householdMemberId, propertyId } = parsed.data
  const debtId = body.debtId ?? null

  // Verify ownership of referenced accountId and categoryId
  if (accountId) {
    const account = await db.account.findFirst({
      where: { id: accountId, userId: session.userId },
    })
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }
  if (categoryId) {
    const category = await db.category.findFirst({
      where: { id: categoryId, OR: [{ userId: session.userId }, { userId: null, isDefault: true }] },
    })
    if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 })
  }

  // Correct amount sign based on category type — must match server action behavior.
  // Income = positive, expense = negative, transfer = keep user sign.
  let finalAmount = amount
  let resolvedCategory: { type: string; group: string | null } | null = null
  if (categoryId) {
    const category = await db.category.findFirst({
      where: { id: categoryId, OR: [{ userId: session.userId }, { userId: null, isDefault: true }] },
    })
    if (category) {
      resolvedCategory = category
      if (category.type === 'expense') finalAmount = -Math.abs(amount)
      else if (category.type === 'income') finalAmount = Math.abs(amount)
    }
  }
  // Derive classification from category group (deterministic hierarchy).
  const classification = classifyTransaction(
    resolvedCategory?.group,
    resolvedCategory?.type,
    finalAmount,
  )

  // R3.2a: If no person tag provided, default to account owner
  let resolvedMemberId: string | null = householdMemberId ?? null
  if (!resolvedMemberId && accountId) {
    const acctWithOwner = await db.account.findFirst({
      where: { id: accountId, userId: session.userId },
      select: { ownerId: true },
    })
    if (acctWithOwner?.ownerId) {
      resolvedMemberId = acctWithOwner.ownerId
    }
  }

  // Verify ownership of referenced householdMemberId
  if (resolvedMemberId) {
    const member = await db.householdMember.findFirst({
      where: { id: resolvedMemberId, userId: session.userId },
    })
    if (!member) return NextResponse.json({ error: 'Household member not found' }, { status: 404 })
  }

  // Auto-resolve property from account-property link if not explicitly set
  let resolvedPropertyId = propertyId ?? null
  if (!resolvedPropertyId && accountId) {
    const link = await db.accountPropertyLink.findFirst({
      where: { accountId },
      select: { propertyId: true },
    })
    if (link) {
      resolvedPropertyId = link.propertyId
    }
  }

  // Verify ownership of referenced propertyId
  if (resolvedPropertyId) {
    const property = await db.property.findFirst({
      where: { id: resolvedPropertyId, userId: session.userId },
    })
    if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 })
  }

  // R5.8: Verify ownership of referenced debtId
  if (debtId) {
    const debt = await db.debt.findFirst({
      where: { id: debtId, userId: session.userId },
    })
    if (!debt) return NextResponse.json({ error: 'Debt not found' }, { status: 404 })
  }

  const transaction = await db.$transaction(async (tx) => {
    const created = await tx.transaction.create({
      data: {
        userId: session.userId,
        accountId: accountId ?? null,
        categoryId: categoryId ?? null,
        amount: finalAmount,
        classification,
        merchant,
        date: new Date(date.includes('T') ? date : `${date}T12:00:00`),
        notes: notes ?? null,
        tags: tags ?? null,
        householdMemberId: resolvedMemberId,
        propertyId: resolvedPropertyId,
        debtId: debtId ?? null,
      },
      include: { account: true, category: true, householdMember: true, property: true, debt: true },
    })

    // Update account balance
    if (created.accountId) {
      await tx.account.update({
        where: { id: created.accountId },
        data: { balance: { increment: created.amount } },
      })
    }

    // R5.8: Debt payments reduce currentBalance (payment is negative amount)
    if (created.debtId && created.amount < 0) {
      await tx.debt.update({
        where: { id: created.debtId },
        data: { currentBalance: { decrement: Math.abs(created.amount) } },
      })
    }

    // Auto-apply property attribution splits
    await applyPropertyAttribution(
      created.id,
      created.propertyId,
      created.amount,
      created.merchant,
      created.category?.name,
      null,
      tx
    )

    return created
  })

  revalidatePath('/dashboard')
  revalidatePath('/transactions')
  revalidatePath('/budgets')
  revalidatePath('/spending')
  return NextResponse.json(transaction, { status: 201 })
}
