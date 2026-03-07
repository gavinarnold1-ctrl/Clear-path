import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { classifyTransaction } from '@/lib/category-groups'
import { applyPropertyAttribution } from '@/lib/apply-splits'
import { createTransactionSchema, validateBody } from '@/lib/validation'
const VALID_CATEGORY_TYPES = new Set(['income', 'expense', 'transfer', 'perk_reimbursement'])
const VALID_CLASSIFICATIONS = new Set(['expense', 'income', 'transfer', 'perk_reimbursement'])

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)

  // Pagination params
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 1), 200)
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0)
  const sortBy = searchParams.get('sortBy') ?? 'date'
  const sortDir = searchParams.get('sortDir') === 'asc' ? 'asc' as const : 'desc' as const

  // Filter params
  const categoryType = searchParams.get('categoryType') ?? undefined
  const accountId = searchParams.get('accountId') ?? undefined
  const categoryId = searchParams.get('categoryId') ?? undefined
  const householdMemberId = searchParams.get('householdMemberId') ?? undefined
  const propertyId = searchParams.get('propertyId') ?? undefined
  const classification = searchParams.get('classification') ?? undefined
  const search = searchParams.get('search') ?? undefined
  const dateFrom = searchParams.get('dateFrom') ?? undefined
  const dateTo = searchParams.get('dateTo') ?? undefined
  const amountMin = searchParams.get('amountMin') ?? undefined
  const amountMax = searchParams.get('amountMax') ?? undefined
  const uncategorized = searchParams.get('uncategorized') === 'true'
  const annualExpenseId = searchParams.get('annualExpenseId') ?? undefined
  const month = searchParams.get('month') ?? undefined

  if (categoryType && !VALID_CATEGORY_TYPES.has(categoryType)) {
    return NextResponse.json({ error: 'Invalid category type filter' }, { status: 400 })
  }
  if (classification && !VALID_CLASSIFICATIONS.has(classification)) {
    return NextResponse.json({ error: 'Invalid classification filter' }, { status: 400 })
  }

  // Build where clause
  const where: Record<string, unknown> = { userId: session.userId }

  if (categoryType) where.category = { type: categoryType }
  if (accountId) {
    where.accountId = accountId === '__none__' ? null : accountId
  }
  if (categoryId) where.categoryId = categoryId
  if (householdMemberId) {
    where.householdMemberId = householdMemberId === '__none__' ? null : householdMemberId
  }
  if (propertyId) {
    where.propertyId = propertyId === '__none__' ? null : propertyId
  }
  if (classification) where.classification = classification
  if (uncategorized) where.categoryId = null
  if (annualExpenseId) where.annualExpenseId = annualExpenseId

  // Month filter: parse YYYY-MM into date range
  if (month) {
    const [y, m] = month.split('-').map(Number)
    if (y && m) {
      const start = new Date(Date.UTC(y, m - 1, 1))
      const end = new Date(Date.UTC(y, m, 1))
      where.date = { ...(where.date as Record<string, unknown> ?? {}), gte: start, lt: end }
    }
  }

  // Date range filter
  if (dateFrom) {
    where.date = { ...(where.date as Record<string, unknown> ?? {}), gte: new Date(dateFrom) }
  }
  if (dateTo) {
    where.date = { ...(where.date as Record<string, unknown> ?? {}), lte: new Date(dateTo + 'T23:59:59.999Z') }
  }

  // Amount range filter
  if (amountMin) {
    where.amount = { ...(where.amount as Record<string, unknown> ?? {}), gte: parseFloat(amountMin) }
  }
  if (amountMax) {
    where.amount = { ...(where.amount as Record<string, unknown> ?? {}), lte: parseFloat(amountMax) }
  }

  // Search filter: merchant ILIKE
  if (search) {
    where.merchant = { contains: search, mode: 'insensitive' }
  }

  // Build orderBy
  const VALID_SORT_COLUMNS: Record<string, unknown> = {
    date: { date: sortDir },
    merchant: { merchant: sortDir },
    amount: { amount: sortDir },
  }
  const orderBy = VALID_SORT_COLUMNS[sortBy] ?? { date: sortDir }

  // Run count + paginated query in parallel
  const [total, transactions] = await Promise.all([
    db.transaction.count({ where }),
    db.transaction.findMany({
      where,
      select: {
        id: true,
        date: true,
        merchant: true,
        amount: true,
        notes: true,
        categoryId: true,
        accountId: true,
        householdMemberId: true,
        propertyId: true,
        classification: true,
        annualExpenseId: true,
        isPending: true,
        category: { select: { id: true, name: true } },
        account: { select: { id: true, name: true } },
        householdMember: { select: { id: true, name: true } },
        property: { select: { id: true, name: true } },
        splits: {
          select: {
            id: true,
            propertyId: true,
            amount: true,
            property: { select: { id: true, name: true, taxSchedule: true } },
          },
          orderBy: { amount: 'desc' },
        },
      },
      orderBy,
      skip: offset,
      take: limit,
    }),
  ])

  return NextResponse.json({
    transactions: transactions.map(tx => ({
      ...tx,
      date: tx.date.toISOString(),
      amount: Number(tx.amount),
      splits: tx.splits.map(s => ({ ...s, amount: Number(s.amount) })),
    })),
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
  }, {
    headers: { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=30' },
  })
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

  // Auto-apply learned category if none provided — use merchant→category mappings
  let resolvedCategoryId = categoryId ?? null
  if (!resolvedCategoryId && merchant) {
    const normalizedMerchant = merchant.toLowerCase().trim()
    const direction = amount > 0 ? 'credit' : 'debit'
    const absAmount = Math.abs(amount)

    try {
      const mappings = await db.userCategoryMapping.findMany({
        where: { userId: session.userId, merchantName: normalizedMerchant },
        orderBy: { timesApplied: 'desc' },
      })

      let bestMapping: (typeof mappings)[0] | null = null
      let bestScore = 0

      for (const m of mappings) {
        let score = 0.7 // Base: merchant name exact match
        if (m.direction) {
          if (m.direction === direction) score += 0.15
          else score -= 0.5
        }
        if (m.amountMin != null && m.amountMax != null) {
          if (absAmount >= m.amountMin && absAmount <= m.amountMax) score += 0.15
          else score -= 0.2
        }
        if (score > bestScore) {
          bestScore = score
          bestMapping = m
        }
      }

      if (bestMapping && bestScore >= 0.7) {
        resolvedCategoryId = bestMapping.categoryId
        // Increment usage counter
        db.userCategoryMapping.update({
          where: { id: bestMapping.id },
          data: { timesApplied: { increment: 1 } },
        }).catch(() => { /* non-critical */ })
      }
    } catch {
      // Non-critical — proceed without auto-category
    }
  }

  // Correct amount sign based on category type — must match server action behavior.
  // Income = positive, expense = negative, transfer = keep user sign.
  let finalAmount = amount
  let resolvedCategory: { type: string; group: string | null } | null = null
  if (resolvedCategoryId) {
    const category = await db.category.findFirst({
      where: { id: resolvedCategoryId, OR: [{ userId: session.userId }, { userId: null, isDefault: true }] },
    })
    if (category) {
      resolvedCategory = category
      if (category.type === 'expense') finalAmount = -Math.abs(amount)
      else if (category.type === 'income') finalAmount = Math.abs(amount)
      else if (category.type === 'perk_reimbursement') finalAmount = Math.abs(amount)
    }
  }
  // Derive classification from category group (deterministic hierarchy).
  // Perk reimbursements bypass the normal hierarchy — classified directly from category type.
  const classification = resolvedCategory?.type === 'perk_reimbursement'
    ? 'perk_reimbursement'
    : classifyTransaction(
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
        categoryId: resolvedCategoryId,
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
