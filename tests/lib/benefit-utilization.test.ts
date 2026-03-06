/**
 * Tests for the benefit utilization calculator.
 */
import { describe, it, expect } from 'vitest'
import {
  calculateBenefitUtilization,
  calculateAllBenefitUtilizations,
} from '@/lib/engines/benefit-utilization'
import type {
  BenefitForUtilization,
  UtilizationTransaction,
} from '@/lib/engines/benefit-utilization'

const uberBenefit: BenefitForUtilization = {
  id: 'b1',
  name: 'Uber Cash',
  creditAmount: 15,
  creditCycle: 'MONTHLY',
  eligibleMerchants: ['Uber', 'Uber Eats'],
  merchantMatchType: 'contains',
}

describe('calculateBenefitUtilization', () => {
  it('returns unused status when no matching transactions', () => {
    const result = calculateBenefitUtilization(uberBenefit, [])
    expect(result.status).toBe('unused')
    expect(result.confirmedUsed).toBe(0)
    expect(result.pendingUsed).toBe(0)
    expect(result.totalUsed).toBe(0)
    expect(result.remaining).toBe(15)
  })

  it('tracks confirmed usage from perk_reimbursement transactions with matching tags', () => {
    const txs: UtilizationTransaction[] = [
      {
        id: 'tx1',
        amount: 15,
        classification: 'perk_reimbursement',
        merchant: 'AMEX UBER CASH',
        date: '2026-03-01',
        tags: 'card_benefit:Uber Cash',
      },
    ]
    const result = calculateBenefitUtilization(uberBenefit, txs)
    expect(result.confirmedUsed).toBe(15)
    expect(result.status).toBe('fully_used')
    expect(result.remaining).toBe(0)
    expect(result.confirmedTransactionIds).toEqual(['tx1'])
  })

  it('shows partial status when confirmed used is less than credit limit', () => {
    const txs: UtilizationTransaction[] = [
      {
        id: 'tx1',
        amount: 10,
        classification: 'perk_reimbursement',
        merchant: 'AMEX UBER CASH',
        date: '2026-03-01',
        tags: 'card_benefit:Uber Cash',
      },
    ]
    const result = calculateBenefitUtilization(uberBenefit, txs)
    expect(result.confirmedUsed).toBe(10)
    expect(result.status).toBe('partial')
    expect(result.remaining).toBe(5)
  })

  it('shows exceeded status when confirmed exceeds credit limit', () => {
    const txs: UtilizationTransaction[] = [
      {
        id: 'tx1',
        amount: 20,
        classification: 'perk_reimbursement',
        merchant: 'AMEX UBER CASH',
        date: '2026-03-01',
        tags: 'card_benefit:Uber Cash',
      },
    ]
    const result = calculateBenefitUtilization(uberBenefit, txs)
    expect(result.confirmedUsed).toBe(20)
    expect(result.status).toBe('exceeded')
    expect(result.remaining).toBe(0)
  })

  it('tracks pending usage from eligible merchant charges when no credits posted', () => {
    const txs: UtilizationTransaction[] = [
      {
        id: 'charge1',
        amount: -12.50,
        classification: 'expense',
        merchant: 'Uber Eats',
        date: '2026-03-05',
        tags: null,
      },
    ]
    const result = calculateBenefitUtilization(uberBenefit, txs)
    expect(result.pendingUsed).toBe(12.50)
    expect(result.status).toBe('pending')
    expect(result.pendingTransactionIds).toEqual(['charge1'])
  })

  it('does not show pending charges when confirmed credits exist', () => {
    const txs: UtilizationTransaction[] = [
      {
        id: 'credit1',
        amount: 15,
        classification: 'perk_reimbursement',
        merchant: 'AMEX UBER CASH',
        date: '2026-03-01',
        tags: 'card_benefit:Uber Cash',
      },
      {
        id: 'charge1',
        amount: -12.50,
        classification: 'expense',
        merchant: 'Uber Eats',
        date: '2026-03-05',
        tags: null,
      },
    ]
    const result = calculateBenefitUtilization(uberBenefit, txs)
    expect(result.confirmedUsed).toBe(15)
    expect(result.pendingUsed).toBe(0)
    expect(result.pendingTransactionIds).toEqual([])
  })

  it('ignores transactions with wrong tags', () => {
    const txs: UtilizationTransaction[] = [
      {
        id: 'tx1',
        amount: 15,
        classification: 'perk_reimbursement',
        merchant: 'AMEX Credit',
        date: '2026-03-01',
        tags: 'card_benefit:Other Benefit',
      },
    ]
    const result = calculateBenefitUtilization(uberBenefit, txs)
    expect(result.confirmedUsed).toBe(0)
    expect(result.status).toBe('unused')
  })

  it('handles null creditAmount gracefully', () => {
    const benefit: BenefitForUtilization = {
      ...uberBenefit,
      creditAmount: null,
    }
    const result = calculateBenefitUtilization(benefit, [])
    expect(result.creditLimit).toBe(0)
    expect(result.remaining).toBe(0)
  })

  it('rounds amounts to 2 decimal places', () => {
    const txs: UtilizationTransaction[] = [
      {
        id: 'tx1',
        amount: 10.333,
        classification: 'perk_reimbursement',
        merchant: 'AMEX UBER CASH',
        date: '2026-03-01',
        tags: 'card_benefit:Uber Cash',
      },
    ]
    const result = calculateBenefitUtilization(uberBenefit, txs)
    expect(result.confirmedUsed).toBe(10.33)
    expect(result.remaining).toBe(4.67)
  })
})

describe('calculateAllBenefitUtilizations', () => {
  it('filters out benefits without creditAmount', () => {
    const benefits: BenefitForUtilization[] = [
      uberBenefit,
      { ...uberBenefit, id: 'b2', name: 'No Credit', creditAmount: null },
      { ...uberBenefit, id: 'b3', name: 'Zero Credit', creditAmount: 0 },
    ]
    const results = calculateAllBenefitUtilizations(benefits, [])
    expect(results).toHaveLength(1)
    expect(results[0].benefitId).toBe('b1')
  })
})
