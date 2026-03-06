/**
 * Tests for the perk credit detection engine.
 */
import { describe, it, expect } from 'vitest'
import { detectPerkCredit } from '@/lib/engines/perk-detection'
import type { BenefitForMatching } from '@/lib/engines/perk-detection'

const uberCashBenefit: BenefitForMatching = {
  id: 'b1',
  name: 'Uber Cash',
  type: 'statement_credit',
  creditAmount: 15,
  creditCycle: 'MONTHLY',
  eligibleMerchants: ['Uber', 'Uber Eats'],
  merchantMatchType: 'contains',
  creditMerchantPatterns: ['AMEX UBER CASH', 'Uber Cash Credit'],
  isTransactionTrackable: true,
}

const saksBenefit: BenefitForMatching = {
  id: 'b2',
  name: 'Saks Credit',
  type: 'statement_credit',
  creditAmount: 50,
  creditCycle: 'MONTHLY',
  eligibleMerchants: ['Saks Fifth Avenue', 'Saks'],
  merchantMatchType: 'contains',
  creditMerchantPatterns: ['AMEX SAKS CREDIT'],
  isTransactionTrackable: true,
}

const nonTrackableBenefit: BenefitForMatching = {
  id: 'b3',
  name: 'TSA PreCheck',
  type: 'statement_credit',
  creditAmount: 100,
  creditCycle: 'CARDMEMBER_YEAR',
  eligibleMerchants: ['TSA'],
  merchantMatchType: 'contains',
  creditMerchantPatterns: null,
  isTransactionTrackable: false,
}

const benefits = [uberCashBenefit, saksBenefit, nonTrackableBenefit]

describe('detectPerkCredit', () => {
  it('returns null for negative amounts', () => {
    expect(detectPerkCredit('AMEX UBER CASH', -15, benefits)).toBeNull()
  })

  it('returns null for zero amounts', () => {
    expect(detectPerkCredit('AMEX UBER CASH', 0, benefits)).toBeNull()
  })

  it('returns null when no benefits are trackable', () => {
    expect(detectPerkCredit('AMEX UBER CASH', 15, [nonTrackableBenefit])).toBeNull()
  })

  it('returns null when merchant does not match any pattern', () => {
    expect(detectPerkCredit('Random Store', 15, benefits)).toBeNull()
  })

  it('matches credit merchant patterns with high confidence', () => {
    const result = detectPerkCredit('AMEX UBER CASH', 15, benefits)
    expect(result).not.toBeNull()
    expect(result!.benefitId).toBe('b1')
    expect(result!.benefitName).toBe('Uber Cash')
    expect(result!.confidence).toBe(0.95)
    expect(result!.matchSource).toBe('credit_pattern')
  })

  it('matches eligible merchants with lower confidence', () => {
    // "Uber" matches eligible merchants but not credit patterns
    const benefitsNoCreditPatterns: BenefitForMatching[] = [{
      ...uberCashBenefit,
      creditMerchantPatterns: null,
    }]
    const result = detectPerkCredit('Uber', 10, benefitsNoCreditPatterns)
    expect(result).not.toBeNull()
    expect(result!.confidence).toBe(0.75)
    expect(result!.matchSource).toBe('eligible_merchant')
  })

  it('prefers credit pattern match over eligible merchant match', () => {
    const result = detectPerkCredit('AMEX SAKS CREDIT', 50, benefits)
    expect(result).not.toBeNull()
    expect(result!.benefitName).toBe('Saks Credit')
    expect(result!.matchSource).toBe('credit_pattern')
  })

  it('lowers confidence when amount exceeds benefit credit limit by >10%', () => {
    // Uber Cash benefit is $15; a $20 credit is >10% over
    const result = detectPerkCredit('AMEX UBER CASH', 20, benefits)
    expect(result).not.toBeNull()
    expect(result!.confidence).toBeLessThan(0.95)
  })

  it('keeps full confidence when amount is within 10% of benefit limit', () => {
    const result = detectPerkCredit('AMEX UBER CASH', 15, benefits)
    expect(result).not.toBeNull()
    expect(result!.confidence).toBe(0.95)
  })

  it('handles case-insensitive matching', () => {
    const result = detectPerkCredit('amex uber cash', 15, benefits)
    expect(result).not.toBeNull()
    expect(result!.benefitName).toBe('Uber Cash')
  })

  it('handles special characters in merchant names', () => {
    const result = detectPerkCredit('AMEX - UBER CASH!', 15, benefits)
    expect(result).not.toBeNull()
    expect(result!.benefitName).toBe('Uber Cash')
  })
})
