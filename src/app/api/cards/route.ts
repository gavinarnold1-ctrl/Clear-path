import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { detectPerkCredit } from '@/lib/engines/perk-detection'
import type { BenefitForMatching } from '@/lib/engines/perk-detection'

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

  // R3D: Backfill scan — reclassify historical perk credits on the linked account
  let backfillCount = 0
  let backfillTotal = 0
  if (accountId && fullCard) {
    try {
      const trackableBenefits: BenefitForMatching[] = program.benefits
        .filter(b => b.isTransactionTrackable && b.isActive)
        .map(b => ({
          id: b.id,
          name: b.name,
          type: b.type,
          creditAmount: b.creditAmount,
          creditCycle: b.creditCycle,
          eligibleMerchants: b.eligibleMerchants as string[] | null,
          merchantMatchType: b.merchantMatchType,
          creditMerchantPatterns: b.creditMerchantPatterns as string[] | null,
          isTransactionTrackable: b.isTransactionTrackable,
        }))

      if (trackableBenefits.length > 0) {
        // Find the "Card Perk Credits" category
        const perkCategory = await db.category.findFirst({
          where: {
            name: { equals: 'Card Perk Credits', mode: 'insensitive' },
            OR: [{ userId: session.userId }, { userId: null, isDefault: true }],
          },
        })

        if (perkCategory) {
          // Query positive-amount transactions on this account from the past 12 months
          const twelveMonthsAgo = new Date()
          twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

          const candidates = await db.transaction.findMany({
            where: {
              userId: session.userId,
              accountId,
              amount: { gt: 0 },
              classification: { not: 'perk_reimbursement' },
              date: { gte: twelveMonthsAgo },
            },
            select: { id: true, merchant: true, amount: true, tags: true },
          })

          for (const candidate of candidates) {
            const match = detectPerkCredit(candidate.merchant, candidate.amount, trackableBenefits)
            if (match && match.confidence >= 0.7) {
              const tag = `card_benefit:${match.benefitName}`
              const existingTags = candidate.tags ? candidate.tags.split(',').map(t => t.trim()) : []
              if (!existingTags.includes(tag)) {
                existingTags.push(tag)
              }
              await db.transaction.update({
                where: { id: candidate.id },
                data: {
                  classification: 'perk_reimbursement',
                  categoryId: perkCategory.id,
                  tags: existingTags.join(','),
                },
              })
              backfillCount++
              backfillTotal += candidate.amount
            }
          }
        }
      }
    } catch {
      // Non-critical — don't fail card confirmation if backfill errors
    }
  }

  return NextResponse.json({
    card: fullCard,
    backfill: backfillCount > 0 ? {
      count: backfillCount,
      total: Math.round(backfillTotal * 100) / 100,
      message: `Found ${backfillCount} perk credit${backfillCount !== 1 ? 's' : ''} totaling $${backfillTotal.toFixed(2)} on this account`,
    } : null,
  }, { status: 201 })
}
