/**
 * Net card value calculator — pure logic module.
 *
 * Computes annual net value per card: total benefit value minus annual fee.
 * No database imports, no auth, no framework dependencies.
 */

export interface CardValueBenefit {
  type: string // "cashback" | "points_multiplier" | "statement_credit" | "insurance" | "perk"
  creditAmount: number | null
  creditCycle: string | null
  rewardRate: number | null
  rewardUnit: string | null
  maxReward: number | null
  isOptedIn: boolean
  usedAmount: number
}

export interface CardForValueCalc {
  userCardId: string
  cardLabel: string
  annualFee: number
  benefits: CardValueBenefit[]
  annualSpendOnCard: number // Total annual spend on this card's account
}

export interface CardNetValue {
  userCardId: string
  cardLabel: string
  annualFee: number
  totalBenefitValue: number
  creditValue: number
  estimatedRewardsValue: number
  netValue: number // totalBenefitValue - annualFee
  isPositiveValue: boolean
  breakdown: {
    label: string
    value: number
  }[]
}

/**
 * Annualize a credit amount based on its refresh cycle.
 */
function annualizeCredit(amount: number, cycle: string | null): number {
  switch (cycle) {
    case 'MONTHLY':
      return amount * 12
    case 'QUARTERLY':
      return amount * 4
    case 'ANNUALLY':
    case 'CALENDAR_YEAR':
    case 'CARDMEMBER_YEAR':
      return amount
    default:
      return amount
  }
}

/**
 * Compute the net value of each card.
 *
 * For statement credits: annualized credit value.
 * For rewards: estimated annual rewards based on spend and reward rate.
 * Subtract annual fee for net value.
 */
export function computeCardNetValues(cards: CardForValueCalc[]): CardNetValue[] {
  return cards.map((card) => {
    const breakdown: { label: string; value: number }[] = []
    let creditValue = 0
    let estimatedRewardsValue = 0

    for (const b of card.benefits) {
      if (!b.isOptedIn) continue

      if (b.type === 'statement_credit' && b.creditAmount) {
        const annualized = annualizeCredit(b.creditAmount, b.creditCycle)
        creditValue += annualized
        breakdown.push({ label: `Statement credit (${b.creditCycle ?? 'annual'})`, value: annualized })
      } else if ((b.type === 'cashback' || b.type === 'points_multiplier') && b.rewardRate) {
        // Estimate value: reward rate * annual spend, capped by maxReward if set
        let rewardValue: number
        if (b.rewardUnit === 'percent') {
          rewardValue = card.annualSpendOnCard * b.rewardRate
        } else {
          // Points per dollar — assume 1 cent per point for estimation
          rewardValue = card.annualSpendOnCard * b.rewardRate * 0.01
        }

        if (b.maxReward) {
          rewardValue = Math.min(rewardValue, b.maxReward)
        }

        estimatedRewardsValue += rewardValue
      }
    }

    if (estimatedRewardsValue > 0) {
      breakdown.push({ label: 'Estimated rewards', value: Math.round(estimatedRewardsValue * 100) / 100 })
    }

    if (card.annualFee > 0) {
      breakdown.push({ label: 'Annual fee', value: -card.annualFee })
    }

    const totalBenefitValue = Math.round((creditValue + estimatedRewardsValue) * 100) / 100
    const netValue = Math.round((totalBenefitValue - card.annualFee) * 100) / 100

    return {
      userCardId: card.userCardId,
      cardLabel: card.cardLabel,
      annualFee: card.annualFee,
      totalBenefitValue,
      creditValue: Math.round(creditValue * 100) / 100,
      estimatedRewardsValue: Math.round(estimatedRewardsValue * 100) / 100,
      netValue,
      isPositiveValue: netValue >= 0,
      breakdown,
    }
  })
}
