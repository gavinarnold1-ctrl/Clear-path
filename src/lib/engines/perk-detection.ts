/**
 * Perk credit detection engine — pure logic module.
 *
 * Matches positive-amount credit card transactions against known card benefit
 * merchant patterns to identify perk reimbursements (e.g., Amex Uber Cash credits).
 *
 * No database imports, no auth, no framework dependencies.
 */

export interface BenefitForMatching {
  id: string
  name: string
  type: string
  creditAmount: number | null
  creditCycle: string | null
  eligibleMerchants: string[] | null
  merchantMatchType: string
  creditMerchantPatterns: string[] | null
  isTransactionTrackable: boolean
}

export interface PerkMatchResult {
  benefitId: string
  benefitName: string
  confidence: number // 0-1
  matchedPattern: string
  matchSource: 'credit_pattern' | 'eligible_merchant'
}

/**
 * Normalize text for merchant matching: lowercase, strip non-alphanumeric (except spaces).
 */
function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
}

/**
 * Check if a merchant string matches any pattern from a list using the given match type.
 * Returns the matched pattern or null.
 */
function matchesPatterns(
  merchant: string,
  patterns: string[],
  matchType: string,
): string | null {
  const normalizedMerchant = normalize(merchant)
  for (const pattern of patterns) {
    const normalizedPattern = normalize(pattern)
    if (!normalizedPattern) continue

    switch (matchType) {
      case 'exact':
        if (normalizedMerchant === normalizedPattern) return pattern
        break
      case 'startsWith':
        if (normalizedMerchant.startsWith(normalizedPattern)) return pattern
        break
      case 'contains':
      default:
        if (normalizedMerchant.includes(normalizedPattern)) return pattern
        break
    }
  }
  return null
}

/**
 * Detect whether a positive-amount transaction on a credit card is a perk reimbursement.
 *
 * Matching priority:
 * 1. creditMerchantPatterns (designed for incoming credit descriptions) — higher confidence
 * 2. eligibleMerchants (designed for outgoing charges, but may also match credits) — lower confidence
 *
 * When multiple benefits match, prefer the more specific match (longer pattern).
 */
export function detectPerkCredit(
  merchantName: string,
  amount: number,
  benefits: BenefitForMatching[],
): PerkMatchResult | null {
  if (amount <= 0) return null

  const trackableBenefits = benefits.filter(b => b.isTransactionTrackable)
  if (trackableBenefits.length === 0) return null

  let bestMatch: PerkMatchResult | null = null

  for (const benefit of trackableBenefits) {
    // Try credit-side patterns first (higher confidence)
    const creditPatterns = benefit.creditMerchantPatterns as string[] | null
    if (creditPatterns && creditPatterns.length > 0) {
      const matched = matchesPatterns(merchantName, creditPatterns, benefit.merchantMatchType)
      if (matched) {
        const confidence = 0.95
        if (!bestMatch || confidence > bestMatch.confidence || matched.length > bestMatch.matchedPattern.length) {
          bestMatch = {
            benefitId: benefit.id,
            benefitName: benefit.name,
            confidence,
            matchedPattern: matched,
            matchSource: 'credit_pattern',
          }
        }
        continue // Don't also check eligibleMerchants for this benefit
      }
    }

    // Fall back to eligible merchants (designed for charges, but may match credits too)
    const eligibleMerchants = benefit.eligibleMerchants as string[] | null
    if (eligibleMerchants && eligibleMerchants.length > 0) {
      const matched = matchesPatterns(merchantName, eligibleMerchants, benefit.merchantMatchType)
      if (matched) {
        const confidence = 0.75
        if (!bestMatch || confidence > bestMatch.confidence || (confidence === bestMatch.confidence && matched.length > bestMatch.matchedPattern.length)) {
          bestMatch = {
            benefitId: benefit.id,
            benefitName: benefit.name,
            confidence,
            matchedPattern: matched,
            matchSource: 'eligible_merchant',
          }
        }
      }
    }
  }

  // Amount reasonableness check: credit should not exceed benefit value
  if (bestMatch) {
    const benefit = trackableBenefits.find(b => b.id === bestMatch!.benefitId)
    if (benefit?.creditAmount && amount > benefit.creditAmount * 1.1) {
      // Amount exceeds benefit value by >10% — lower confidence
      bestMatch.confidence = Math.max(bestMatch.confidence - 0.2, 0.5)
    }
  }

  return bestMatch
}
