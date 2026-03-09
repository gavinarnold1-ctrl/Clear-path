import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import BenefitsDashboard from '@/components/accounts/BenefitsDashboard'
import { computeCardNetValues } from '@/lib/engines/card-value'
import type { CardForValueCalc } from '@/lib/engines/card-value'

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

  // Compute annual spend per card account for rewards estimation
  const yearStart = new Date(new Date().getFullYear(), 0, 1)
  const accountIds = userCards
    .map((c) => c.accountId)
    .filter((id): id is string => id !== null)
  const annualSpendByAccount = new Map<string, number>()
  if (accountIds.length > 0) {
    const spendAgg = await db.transaction.groupBy({
      by: ['accountId'],
      where: {
        userId: session.userId,
        accountId: { in: accountIds },
        date: { gte: yearStart },
        classification: 'expense',
        amount: { lt: 0 },
      },
      _sum: { amount: true },
    })
    for (const row of spendAgg) {
      if (row.accountId) {
        annualSpendByAccount.set(row.accountId, Math.abs(row._sum.amount ?? 0))
      }
    }
  }

  // Compute net card values
  const cardValueInputs: CardForValueCalc[] = userCards.map((card) => ({
    userCardId: card.id,
    cardLabel: `${card.cardProgram.issuer} ${card.cardProgram.name}`,
    annualFee: card.cardProgram.annualFee,
    annualSpendOnCard: card.accountId ? (annualSpendByAccount.get(card.accountId) ?? 0) : 0,
    benefits: card.cardProgram.benefits.map((b) => {
      const tracking = card.benefits.find((ub) => ub.cardBenefitId === b.id)
      return {
        type: b.type,
        creditAmount: b.creditAmount,
        creditCycle: b.creditCycle,
        rewardRate: b.rewardRate,
        rewardUnit: b.rewardUnit,
        maxReward: b.maxReward,
        isOptedIn: tracking?.isOptedIn ?? true,
        usedAmount: tracking?.usedAmount ?? 0,
      }
    }),
  }))
  const cardNetValues = computeCardNetValues(cardValueInputs)
  const netValueMap = Object.fromEntries(cardNetValues.map((v) => [v.userCardId, v]))

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
        isTransactionTrackable: b.isTransactionTrackable,
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
          <h1 className="font-display text-2xl font-bold text-fjord">Card Benefits</h1>
          <p className="mt-1 text-sm text-stone">
            Track your credit card rewards and statement credits.
          </p>
        </div>
        <Link href="/accounts" className="btn-secondary text-sm">
          Back to Accounts
        </Link>
      </div>

      {serialized.length === 0 ? (
        <div className="card mx-auto max-w-lg py-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-birch/20">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-birch"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
          </div>
          <h2 className="font-display text-xl font-semibold text-fjord">
            Track Your Card Benefits
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            Identify your credit cards to unlock rewards tracking, benefit expiration
            reminders, and see the true net value of each card after accounting for
            annual fees.
          </p>
          <div className="mt-6 space-y-3">
            <Link
              href="/accounts"
              className="inline-flex items-center rounded-button bg-pine px-6 py-2.5 text-sm font-medium text-snow transition-colors hover:bg-pine/90"
            >
              Identify Your Cards
            </Link>
            <p className="text-xs text-stone">
              Works with card programs from Chase, Amex, Capital One, Citi, BofA, and more
            </p>
          </div>
        </div>
      ) : (
        <BenefitsDashboard cards={serialized} netValues={netValueMap} />
      )}
    </div>
  )
}
