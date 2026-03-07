import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { createAccountSchema, validateBody } from '@/lib/validation'

export async function GET(_req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accounts = await db.account.findMany({
    where: { userId: session.userId },
    select: {
      id: true,
      name: true,
      type: true,
      balance: true,
      startingBalance: true,
      balanceAsOfDate: true,
      currency: true,
      institution: true,
      isManual: true,
      createdAt: true,
      updatedAt: true,
      plaidAccountId: true,
      plaidLastSynced: true,
      ownerId: true,
      owner: { select: { id: true, name: true } },
      // R11.5: Never expose plaidAccessToken, plaidItemId, or plaidCursor to the frontend
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(accounts, {
    headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
  })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = validateBody(createAccountSchema, body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { name, type, balance, currency, ownerId, balanceAsOfDate } = parsed.data

  const duplicate = await db.account.findFirst({
    where: { userId: session.userId, name: { equals: name, mode: 'insensitive' } },
  })
  if (duplicate) return NextResponse.json({ error: 'An account with this name already exists.' }, { status: 409 })

  // R3.2a: Validate ownerId belongs to this user
  if (ownerId) {
    const member = await db.householdMember.findFirst({
      where: { id: ownerId, userId: session.userId },
    })
    if (!member) return NextResponse.json({ error: 'Household member not found' }, { status: 404 })
  }

  // R1.5b: User-entered balance becomes the startingBalance baseline.
  // Both balance and startingBalance store the same value on creation.
  const startingBal = balance ?? 0

  const account = await db.account.create({
    data: {
      userId: session.userId,
      name,
      type,
      balance: startingBal,
      startingBalance: startingBal,
      balanceAsOfDate: balanceAsOfDate ? new Date(balanceAsOfDate) : null,
      currency: currency ?? 'USD',
      ...(ownerId && { ownerId }),
    },
  })

  revalidatePath('/accounts')
  revalidatePath('/dashboard')
  return NextResponse.json(account, { status: 201 })
}
