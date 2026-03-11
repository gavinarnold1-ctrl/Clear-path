import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { DEMO_USER_ID } from '@/lib/demo'

// PATCH /api/cards/[id] — update card details or benefit tracking
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const card = await db.userCard.findFirst({
    where: { id, userId: session.userId },
  })
  if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const { nickname, lastFourDigits, isActive, benefitUpdates } = body as {
    nickname?: string
    lastFourDigits?: string
    isActive?: boolean
    benefitUpdates?: Array<{ cardBenefitId: string; usedAmount?: number; isOptedIn?: boolean; notes?: string }>
  }

  // Update card fields
  const updated = await db.userCard.update({
    where: { id },
    data: {
      ...(nickname !== undefined && { nickname }),
      ...(lastFourDigits !== undefined && { lastFourDigits }),
      ...(isActive !== undefined && { isActive }),
    },
  })

  // Update benefit tracking if provided
  if (benefitUpdates) {
    for (const update of benefitUpdates) {
      await db.userCardBenefit.updateMany({
        where: { userCardId: id, cardBenefitId: update.cardBenefitId },
        data: {
          ...(update.usedAmount !== undefined && { usedAmount: update.usedAmount }),
          ...(update.isOptedIn !== undefined && { isOptedIn: update.isOptedIn }),
          ...(update.notes !== undefined && { notes: update.notes }),
        },
      })
    }
  }

  const fullCard = await db.userCard.findUnique({
    where: { id },
    include: {
      cardProgram: {
        include: { benefits: { where: { isActive: true } } },
      },
      account: { select: { id: true, name: true, balance: true } },
      benefits: { include: { cardBenefit: true } },
    },
  })

  return NextResponse.json({ card: fullCard })
}

// DELETE /api/cards/[id] — remove a card identification
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (session.userId === DEMO_USER_ID) {
    return NextResponse.json(
      { error: 'Demo accounts cannot delete data. Sign up for a free account to get started!' },
      { status: 403 }
    )
  }

  const { id } = await params
  const card = await db.userCard.findFirst({
    where: { id, userId: session.userId },
  })
  if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 })

  await db.userCard.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
