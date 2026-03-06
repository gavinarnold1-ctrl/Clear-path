import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'

// GET /api/cards — list user's identified cards with benefits
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userCards = await db.userCard.findMany({
    where: { userId: session.userId },
    include: {
      cardProgram: {
        include: {
          benefits: { where: { isActive: true }, orderBy: { type: 'asc' } },
        },
      },
      account: { select: { id: true, name: true, balance: true } },
      benefits: {
        include: { cardBenefit: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ cards: userCards })
}

// POST /api/cards — assign a card program to an account
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { accountId, cardProgramId, nickname, lastFourDigits } = body as {
    accountId?: string
    cardProgramId?: string
    nickname?: string
    lastFourDigits?: string
  }

  if (!cardProgramId) {
    return NextResponse.json({ error: 'cardProgramId is required' }, { status: 400 })
  }

  // Verify card program exists
  const program = await db.cardProgram.findUnique({
    where: { id: cardProgramId },
    include: { benefits: { where: { isActive: true } } },
  })
  if (!program) {
    return NextResponse.json({ error: 'Card program not found' }, { status: 404 })
  }

  // If accountId provided, verify it belongs to user and is a credit card
  if (accountId) {
    const account = await db.account.findFirst({
      where: { id: accountId, userId: session.userId, type: 'CREDIT_CARD' },
    })
    if (!account) {
      return NextResponse.json({ error: 'Credit card account not found' }, { status: 404 })
    }

    // Check if this account already has a card assigned
    const existing = await db.userCard.findUnique({ where: { accountId } })
    if (existing) {
      return NextResponse.json({ error: 'This account already has an identified card' }, { status: 409 })
    }
  }

  // Check if user already has this card program
  const existingProgram = await db.userCard.findUnique({
    where: { userId_cardProgramId: { userId: session.userId, cardProgramId } },
  })
  if (existingProgram) {
    return NextResponse.json({ error: 'You already have this card program' }, { status: 409 })
  }

  // Create the user card and auto-create benefit tracking entries
  const userCard = await db.$transaction(async (tx) => {
    const card = await tx.userCard.create({
      data: {
        userId: session.userId,
        cardProgramId,
        accountId: accountId ?? null,
        nickname: nickname ?? null,
        lastFourDigits: lastFourDigits ?? null,
      },
    })

    // Create UserCardBenefit entries for all active benefits
    for (const benefit of program.benefits) {
      await tx.userCardBenefit.create({
        data: {
          userCardId: card.id,
          cardBenefitId: benefit.id,
        },
      })
    }

    return card
  })

  // Fetch full card with relations
  const fullCard = await db.userCard.findUnique({
    where: { id: userCard.id },
    include: {
      cardProgram: {
        include: { benefits: { where: { isActive: true } } },
      },
      account: { select: { id: true, name: true, balance: true } },
      benefits: { include: { cardBenefit: true } },
    },
  })

  return NextResponse.json({ card: fullCard }, { status: 201 })
}
