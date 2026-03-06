import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { computeBenefitAlerts } from '@/lib/engines/benefit-alerts'
import type { BenefitAlertInput } from '@/lib/engines/benefit-alerts'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userCards = await db.userCard.findMany({
    where: { userId: session.userId, isActive: true },
    select: {
      id: true,
      openedDate: true,
      cardProgram: {
        select: {
          issuer: true,
          name: true,
        },
      },
      benefits: {
        where: { isOptedIn: true },
        select: {
          id: true,
          usedAmount: true,
          lastResetDate: true,
          isOptedIn: true,
          cardBenefit: {
            select: {
              id: true,
              name: true,
              creditAmount: true,
              creditCycle: true,
            },
          },
        },
      },
    },
  })

  const inputs: BenefitAlertInput[] = []

  for (const card of userCards) {
    for (const ub of card.benefits) {
      if (!ub.cardBenefit.creditAmount || !ub.cardBenefit.creditCycle) continue

      inputs.push({
        benefitId: ub.cardBenefit.id,
        benefitName: ub.cardBenefit.name,
        cardIssuer: card.cardProgram.issuer,
        cardName: card.cardProgram.name,
        userCardId: card.id,
        creditAmount: ub.cardBenefit.creditAmount,
        creditCycle: ub.cardBenefit.creditCycle,
        usedAmount: ub.usedAmount,
        lastResetDate: ub.lastResetDate,
        isOptedIn: ub.isOptedIn,
        openedDate: card.openedDate,
      })
    }
  }

  const alerts = computeBenefitAlerts(inputs)

  return NextResponse.json({ alerts })
}
