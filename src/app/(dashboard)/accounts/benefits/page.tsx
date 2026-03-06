import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import BenefitsDashboard from '@/components/accounts/BenefitsDashboard'

export const metadata: Metadata = { title: 'Card Benefits' }

export default async function BenefitsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const userCards = await db.userCard.findMany({
    where: { userId: session.userId, isActive: true },
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

  // Serialize dates for client component
  const serialized = userCards.map((card) => ({
    id: card.id,
    nickname: card.nickname,
    lastFourDigits: card.lastFourDigits,
    isActive: card.isActive,
    accountId: card.accountId,
    accountName: card.account?.name ?? null,
    accountBalance: card.account?.balance ?? null,
    program: {
      id: card.cardProgram.id,
      issuer: card.cardProgram.issuer,
      name: card.cardProgram.name,
      tier: card.cardProgram.tier,
      annualFee: card.cardProgram.annualFee,
      rewardsCurrency: card.cardProgram.rewardsCurrency,
      foreignTxFee: card.cardProgram.foreignTxFee,
      benefits: card.cardProgram.benefits.map((b) => ({
        id: b.id,
        name: b.name,
        type: b.type,
        category: b.category,
        rewardRate: b.rewardRate,
        rewardUnit: b.rewardUnit,
        maxReward: b.maxReward,
        creditAmount: b.creditAmount,
        creditCycle: b.creditCycle,
        description: b.description,
        terms: b.terms,
      })),
    },
    benefitTracking: card.benefits.map((ub) => ({
      id: ub.id,
      cardBenefitId: ub.cardBenefitId,
      usedAmount: ub.usedAmount,
      isOptedIn: ub.isOptedIn,
      notes: ub.notes,
      benefitName: ub.cardBenefit.name,
      benefitType: ub.cardBenefit.type,
      creditAmount: ub.cardBenefit.creditAmount,
      creditCycle: ub.cardBenefit.creditCycle,
    })),
  }))

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fjord">Card Benefits</h1>
          <p className="mt-1 text-sm text-stone">
            Track your credit card rewards and statement credits.
          </p>
        </div>
        <Link href="/accounts" className="btn-secondary text-sm">
          Back to Accounts
        </Link>
      </div>

      {serialized.length === 0 ? (
        <div className="card py-16 text-center">
          <p className="mb-2 text-sm font-medium text-stone">No cards identified yet</p>
          <p className="mb-4 text-xs text-stone">
            Go to your accounts page to identify your credit cards and unlock benefits tracking.
          </p>
          <Link href="/accounts" className="btn-primary inline-block">
            Identify Cards
          </Link>
        </div>
      ) : (
        <BenefitsDashboard cards={serialized} />
      )}
    </div>
  )
}
