import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

const VALID_TYPES = new Set([
  'CHECKING', 'SAVINGS', 'CREDIT_CARD', 'INVESTMENT', 'CASH',
  'MORTGAGE', 'AUTO_LOAN', 'STUDENT_LOAN',
])

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { name, type, balance, institution, ownerId, startingBalance, balanceAsOfDate } = body

  const existing = await db.account.findFirst({
    where: { id, userId: session.userId },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  if (type && !VALID_TYPES.has(type)) {
    return NextResponse.json({ error: 'Invalid account type' }, { status: 400 })
  }

  // R3.2a: Validate ownerId belongs to this user
  if (ownerId) {
    const member = await db.householdMember.findFirst({
      where: { id: ownerId, userId: session.userId },
    })
    if (!member) {
      return NextResponse.json({ error: 'Household member not found' }, { status: 404 })
    }
  }

  // R1.5b: If baseline fields changed, recompute running balance
  const baselineChanged = startingBalance !== undefined || balanceAsOfDate !== undefined
  const newStarting = startingBalance !== undefined ? parseFloat(startingBalance) : existing.startingBalance
  const newAsOfDate = balanceAsOfDate !== undefined
    ? (balanceAsOfDate ? new Date(balanceAsOfDate) : null)
    : existing.balanceAsOfDate

  let computedBalance: number | undefined
  if (baselineChanged) {
    const dateFilter = newAsOfDate ? { gte: newAsOfDate } : undefined
    const agg = await db.transaction.aggregate({
      where: {
        userId: session.userId,
        accountId: id,
        ...(dateFilter && { date: dateFilter }),
      },
      _sum: { amount: true },
    })
    computedBalance = Math.round((newStarting + (agg._sum.amount ?? 0)) * 100) / 100
  }

  const updated = await db.account.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(type !== undefined && { type }),
      // Direct balance edit only if baseline didn't change (backwards compat)
      ...(!baselineChanged && balance !== undefined && { balance: parseFloat(balance) }),
      ...(startingBalance !== undefined && { startingBalance: newStarting }),
      ...(balanceAsOfDate !== undefined && { balanceAsOfDate: newAsOfDate }),
      ...(computedBalance !== undefined && { balance: computedBalance }),
      ...(institution !== undefined && { institution: institution || null }),
      ...(ownerId !== undefined && { ownerId: ownerId || null }),
    },
    select: {
      id: true, name: true, type: true, balance: true, startingBalance: true,
      balanceAsOfDate: true, currency: true, institution: true, isManual: true,
      createdAt: true, updatedAt: true, plaidAccountId: true, plaidLastSynced: true,
      ownerId: true,
      // R11.5: Never expose plaidAccessToken, plaidItemId, or plaidCursor
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const existing = await db.account.findFirst({
    where: { id, userId: session.userId },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  // Unlink transactions first, then delete account
  await db.$transaction([
    db.transaction.updateMany({
      where: { accountId: id, userId: session.userId },
      data: { accountId: null },
    }),
    db.account.delete({ where: { id } }),
  ])

  return NextResponse.json({ ok: true })
}
