import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

const VALID_DEBT_TYPES = new Set([
  'MORTGAGE',
  'STUDENT_LOAN',
  'AUTO',
  'CREDIT_CARD',
  'PERSONAL_LOAN',
  'OTHER',
])

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const debt = await db.debt.findFirst({
    where: { id, userId: session.userId },
    include: {
      property: true,
      category: true,
      account: { select: { id: true, name: true, type: true, balance: true, institution: true } },
      transactions: {
        select: { id: true, date: true, merchant: true, amount: true },
        orderBy: { date: 'desc' },
      },
    },
  })
  if (!debt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const piPayment = debt.minimumPayment - (debt.escrowAmount ?? 0)
  const monthlyInterest = debt.currentBalance * (debt.interestRate / 12)
  const monthlyPrincipal = Math.max(0, piPayment - monthlyInterest)
  const monthsRemaining =
    monthlyPrincipal > 0 ? Math.ceil(debt.currentBalance / monthlyPrincipal) : null

  return NextResponse.json({
    ...debt,
    monthlyInterest: Math.round(monthlyInterest * 100) / 100,
    monthlyPrincipal: Math.round(monthlyPrincipal * 100) / 100,
    monthsRemaining,
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await db.debt.findFirst({
    where: { id, userId: session.userId },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()

  if (body.type !== undefined && !VALID_DEBT_TYPES.has(body.type)) {
    return NextResponse.json({ error: 'Invalid debt type' }, { status: 400 })
  }

  // Verify ownership of referenced property
  if (body.propertyId !== undefined && body.propertyId !== null) {
    const property = await db.property.findFirst({
      where: { id: body.propertyId, userId: session.userId },
    })
    if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 })
  }

  // Verify ownership of referenced category
  if (body.categoryId !== undefined && body.categoryId !== null) {
    const category = await db.category.findFirst({
      where: { id: body.categoryId, OR: [{ userId: session.userId }, { userId: null, isDefault: true }] },
    })
    if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 })
  }

  // Verify ownership of referenced account
  if (body.accountId !== undefined && body.accountId !== null) {
    const account = await db.account.findFirst({
      where: { id: body.accountId, userId: session.userId },
    })
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  const updated = await db.debt.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.type !== undefined && { type: body.type }),
      ...(body.currentBalance !== undefined && { currentBalance: body.currentBalance }),
      ...(body.originalBalance !== undefined && { originalBalance: body.originalBalance }),
      ...(body.interestRate !== undefined && { interestRate: body.interestRate }),
      ...(body.minimumPayment !== undefined && { minimumPayment: body.minimumPayment }),
      ...(body.escrowAmount !== undefined && { escrowAmount: body.escrowAmount }),
      ...(body.paymentDay !== undefined && { paymentDay: body.paymentDay }),
      ...(body.termMonths !== undefined && { termMonths: body.termMonths }),
      ...(body.startDate !== undefined && { startDate: body.startDate ? new Date(body.startDate) : null }),
      ...(body.propertyId !== undefined && { propertyId: body.propertyId }),
      ...(body.categoryId !== undefined && { categoryId: body.categoryId }),
      ...(body.accountId !== undefined && { accountId: body.accountId }),
    },
    include: { property: true, category: true },
  })

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await db.debt.findFirst({
    where: { id, userId: session.userId },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.debt.delete({ where: { id } })

  return new NextResponse(null, { status: 204 })
}
