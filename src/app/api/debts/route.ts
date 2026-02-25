import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { piBreakdown } from '@/lib/engines/amortization'

const VALID_DEBT_TYPES = new Set([
  'MORTGAGE',
  'STUDENT_LOAN',
  'AUTO',
  'CREDIT_CARD',
  'PERSONAL_LOAN',
  'OTHER',
])

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const debts = await db.debt.findMany({
    where: { userId: session.userId },
    include: {
      property: true,
      category: true,
      account: { select: { id: true, name: true, type: true, balance: true, institution: true } },
      transactions: {
        select: { id: true, date: true, merchant: true, amount: true },
        orderBy: { date: 'desc' },
        take: 10,
      },
    },
    orderBy: { currentBalance: 'desc' },
  })

  // Compute derived fields for each debt via amortization engine
  const enriched = debts.map((debt) => {
    const pi = piBreakdown(debt.currentBalance, debt.interestRate, debt.minimumPayment, debt.escrowAmount)
    return { ...debt, ...pi }
  })

  // Compute summary
  const totalDebt = debts.reduce((sum, d) => sum + d.currentBalance, 0)
  const totalPayments = debts.reduce((sum, d) => sum + d.minimumPayment, 0)
  const weightedRate =
    totalDebt > 0
      ? debts.reduce((sum, d) => sum + d.currentBalance * d.interestRate, 0) / totalDebt
      : 0

  return NextResponse.json({
    debts: enriched,
    summary: {
      totalDebt: Math.round(totalDebt * 100) / 100,
      totalPayments: Math.round(totalPayments * 100) / 100,
      weightedAvgRate: Math.round(weightedRate * 10000) / 10000,
      count: debts.length,
    },
  })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    name,
    type,
    currentBalance,
    originalBalance,
    interestRate,
    minimumPayment,
    escrowAmount,
    paymentDay,
    termMonths,
    startDate,
    propertyId,
    categoryId,
    accountId,
  } = body

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  if (!type || !VALID_DEBT_TYPES.has(type)) {
    return NextResponse.json({ error: 'Invalid debt type' }, { status: 400 })
  }
  if (typeof currentBalance !== 'number' || currentBalance < 0) {
    return NextResponse.json({ error: 'Current balance must be a non-negative number' }, { status: 400 })
  }
  if (typeof interestRate !== 'number' || interestRate < 0) {
    return NextResponse.json({ error: 'Interest rate must be a non-negative number' }, { status: 400 })
  }
  if (typeof minimumPayment !== 'number' || minimumPayment < 0) {
    return NextResponse.json({ error: 'Minimum payment must be a non-negative number' }, { status: 400 })
  }

  // Verify ownership of referenced property
  if (propertyId) {
    const property = await db.property.findFirst({
      where: { id: propertyId, userId: session.userId },
    })
    if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 })
  }

  // Verify ownership of referenced category
  if (categoryId) {
    const category = await db.category.findFirst({
      where: { id: categoryId, OR: [{ userId: session.userId }, { userId: null, isDefault: true }] },
    })
    if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 })
  }

  // Verify ownership of referenced account
  if (accountId) {
    const account = await db.account.findFirst({
      where: { id: accountId, userId: session.userId },
    })
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  const debt = await db.debt.create({
    data: {
      userId: session.userId,
      name: name.trim(),
      type,
      currentBalance,
      originalBalance: originalBalance ?? null,
      interestRate,
      minimumPayment,
      escrowAmount: escrowAmount != null ? escrowAmount : null,
      paymentDay: paymentDay ?? null,
      termMonths: termMonths ?? null,
      startDate: startDate ? new Date(startDate) : null,
      propertyId: propertyId ?? null,
      categoryId: categoryId ?? null,
      accountId: accountId ?? null,
    },
    include: { property: true, category: true },
  })

  // R5.7: Return computed fields so the client can render immediately
  const pi = piBreakdown(debt.currentBalance, debt.interestRate, debt.minimumPayment, debt.escrowAmount)

  return NextResponse.json({ ...debt, ...pi }, { status: 201 })
}
