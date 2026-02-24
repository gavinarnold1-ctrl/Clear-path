import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { classifyTransaction } from '@/lib/classification'

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
    include: { account: true, category: true, householdMember: true, property: true },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json(transactions)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { accountId, categoryId, amount, merchant, date, notes, tags, householdMemberId, propertyId } = body

  if (!amount || !merchant || !date) {
    return NextResponse.json({ error: 'Missing required fields (merchant, amount, date)' }, { status: 400 })
  }

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
  if (categoryId) {
    const category = await db.category.findFirst({
      where: { id: categoryId, OR: [{ userId: session.userId }, { userId: null, isDefault: true }] },
    })
    if (category) {
      if (category.type === 'expense') finalAmount = -Math.abs(amount)
      else if (category.type === 'income') finalAmount = Math.abs(amount)
    }
  }

  // Verify ownership of referenced householdMemberId
  if (householdMemberId) {
    const member = await db.householdMember.findFirst({
      where: { id: householdMemberId, userId: session.userId },
    })
    if (!member) return NextResponse.json({ error: 'Household member not found' }, { status: 404 })
  }

  // Verify ownership of referenced propertyId
  if (propertyId) {
    const property = await db.property.findFirst({
      where: { id: propertyId, userId: session.userId },
    })
    if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 })
  }

  // Determine classification (R1.7)
  let resolvedClassification = body.classification
  if (!resolvedClassification || !VALID_CLASSIFICATIONS.has(resolvedClassification)) {
    if (categoryId) {
      const catForClassify = await db.category.findFirst({
        where: { id: categoryId, OR: [{ userId: session.userId }, { userId: null, isDefault: true }] },
      })
      resolvedClassification = classifyTransaction(catForClassify?.name ?? null, catForClassify?.type ?? null)
    } else {
      resolvedClassification = finalAmount > 0 ? 'income' : 'expense'
    }
  }

  const transaction = await db.$transaction(async (tx) => {
    const created = await tx.transaction.create({
      data: {
        userId: session.userId,
        accountId: accountId ?? null,
        categoryId: categoryId ?? null,
        amount: finalAmount,
        classification: resolvedClassification,
        merchant,
        date: new Date(date),
        notes: notes ?? null,
        tags: tags ?? null,
        householdMemberId: householdMemberId ?? null,
        propertyId: propertyId ?? null,
      },
      include: { account: true, category: true, householdMember: true, property: true },
    })

    // Update account balance
    if (created.accountId) {
      await tx.account.update({
        where: { id: created.accountId },
        data: { balance: { increment: created.amount } },
      })
    }

    return created
  })

  return NextResponse.json(transaction, { status: 201 })
}
