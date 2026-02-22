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
  const { name, type, balance, institution } = body

  const existing = await db.account.findFirst({
    where: { id, userId: session.userId },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  if (type && !VALID_TYPES.has(type)) {
    return NextResponse.json({ error: 'Invalid account type' }, { status: 400 })
  }

  const updated = await db.account.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(type !== undefined && { type }),
      ...(balance !== undefined && { balance: parseFloat(balance) }),
      ...(institution !== undefined && { institution: institution || null }),
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
