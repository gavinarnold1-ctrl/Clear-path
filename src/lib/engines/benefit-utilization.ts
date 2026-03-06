/**
 * Benefit utilization calculator — two-sided tracking.
 *
 * Calculates how much of a card benefit has been utilized by combining:
 * 1. Primary: perk_reimbursement transactions (confirmed by issuer)
 * 2. Supplementary: outgoing charges to eligible merchants (pending credit)
 *
 * Pure logic module — no DB, no auth, no framework imports.
 */

export interface UtilizationTransaction {
  id: string
  amount: number
  classification: string
  merchant: string
  date: string | Date
  tags: string | null
}

export interface BenefitForUtilization {
  id: string
  name: string
  creditAmount: number | null
  creditCycle: string | null
  eligibleMerchants: string[] | null
  merchantMatchType: string
}

export interface BenefitUtilization {
  benefitId: string
  benefitName: string
  creditLimit: number
  confirmedUsed: number // From perk_reimbursement transactions
  pendingUsed: number   // From eligible merchant charges without a matching credit
  totalUsed: number     // confirmed + pending (capped at credit limit)
  remaining: number
  status: 'unused' | 'pending' | 'partial' | 'fully_used' | 'exceeded'
  confirmedTransactionIds: string[]
  pendingTransactionIds: string[]
}

/**
 * Normalize text for merchant matching.
 */
function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
}

/**
 * Check if a merchant matches any pattern using contains matching.
 */
function merchantMatchesAny(merchant: string, patterns: string[]): boolean {
  const norm = normalize(merchant)
  return patterns.some(p => norm.includes(normalize(p)))
}

/**
 * Calculate utilization for a single benefit using two-sided matching.
 *
 * @param benefit - The card benefit to calculate utilization for
 * @param transactions - All transactions for the period (both charges and credits)
 * @param benefitTagPrefix - Tag prefix to match (e.g., "card_benefit:Uber Cash")
 */
export function calculateBenefitUtilization(
  benefit: BenefitForUtilization,
  transactions: UtilizationTransaction[],
): BenefitUtilization {
  const creditLimit = benefit.creditAmount ?? 0

  // 1. Primary: Sum confirmed perk_reimbursement transactions tagged with this benefit
  const confirmedTxs = transactions.filter(tx => {
    if (tx.classification !== 'perk_reimbursement') return false
    if (!tx.tags) return false
    const expectedTag = `card_benefit:${benefit.name}`
    return tx.tags.split(',').map(t => t.trim()).includes(expectedTag)
  })
  const confirmedUsed = confirmedTxs.reduce((sum, tx) => sum + Math.abs(tx.amount), 0)

  // 2. Supplementary: Outgoing charges to eligible merchants (without a matching credit)
  const eligibleMerchants = benefit.eligibleMerchants ?? []
  const pendingTxs: UtilizationTransaction[] = []

  if (eligibleMerchants.length > 0 && confirmedUsed === 0) {
    // Only show pending if no credits have posted yet
    for (const tx of transactions) {
      if (tx.classification !== 'expense') continue
      if (merchantMatchesAny(tx.merchant, eligibleMerchants)) {
        pendingTxs.push(tx)
      }
    }
  }
  const pendingUsed = pendingTxs.reduce((sum, tx) => sum + Math.abs(tx.amount), 0)

  // 3. Credit amount (not charge amount) is the authoritative utilization
  const totalUsed = confirmedUsed > 0 ? Math.min(confirmedUsed, creditLimit || confirmedUsed) : pendingUsed

  const remaining = Math.max(0, creditLimit - totalUsed)

  let status: BenefitUtilization['status'] = 'unused'
  if (confirmedUsed > 0 && creditLimit > 0 && confirmedUsed >= creditLimit) {
    status = confirmedUsed > creditLimit ? 'exceeded' : 'fully_used'
  } else if (confirmedUsed > 0) {
    status = 'partial'
  } else if (pendingUsed > 0) {
    status = 'pending'
  }

  return {
    benefitId: benefit.id,
    benefitName: benefit.name,
    creditLimit,
    confirmedUsed: Math.round(confirmedUsed * 100) / 100,
    pendingUsed: Math.round(pendingUsed * 100) / 100,
    totalUsed: Math.round(totalUsed * 100) / 100,
    remaining: Math.round(remaining * 100) / 100,
    status,
    confirmedTransactionIds: confirmedTxs.map(t => t.id),
    pendingTransactionIds: pendingTxs.map(t => t.id),
  }
}

/**
 * Calculate utilization for all trackable benefits on a card.
 */
export function calculateAllBenefitUtilizations(
  benefits: BenefitForUtilization[],
  transactions: UtilizationTransaction[],
): BenefitUtilization[] {
  return benefits
    .filter(b => b.creditAmount != null && b.creditAmount > 0)
    .map(b => calculateBenefitUtilization(b, transactions))
}
