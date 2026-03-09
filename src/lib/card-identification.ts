import { db } from '@/lib/db'
import type { CardSuggestion } from '@/types'

/**
 * Match a credit card account to a known card program using
 * account name + institution from Plaid or user-entered data.
 */
export async function identifyCardPrograms(userId: string): Promise<CardSuggestion[]> {
  // Get user's credit card accounts that don't already have an identified card
  const accounts = await db.account.findMany({
    where: {
      userId,
      type: 'CREDIT_CARD',
      userCard: null, // Not yet identified
    },
    select: {
      id: true,
      name: true,
      institution: true,
    },
  })

  if (accounts.length === 0) return []

  // Get all active card programs with their patterns
  const programs = await db.cardProgram.findMany({
    where: { isActive: true },
    include: { benefits: { where: { isActive: true } } },
  })

  const suggestions: CardSuggestion[] = []

  for (const account of accounts) {
    const match = findBestMatch(account, programs)
    if (match) {
      suggestions.push(match)
    }
  }

  return suggestions
}

interface AccountInfo {
  id: string
  name: string
  institution: string | null
}

interface ProgramWithBenefits {
  id: string
  issuer: string
  name: string
  tier: string
  annualFee: number
  rewardsCurrency: string | null
  signUpBonus: string | null
  foreignTxFee: number
  isActive: boolean
  plaidPatterns: unknown
  benefits: Array<{
    id: string
    name: string
    type: string
    category: string | null
    rewardRate: number | null
    rewardUnit: string | null
    maxReward: number | null
    creditAmount: number | null
    creditCycle: string | null
    eligibleMerchants: unknown
    merchantMatchType: string
    creditMerchantPatterns: unknown
    isTransactionTrackable: boolean
    description: string
    terms: string | null
    isActive: boolean
  }>
}

function findBestMatch(
  account: AccountInfo,
  programs: ProgramWithBenefits[]
): CardSuggestion | null {
  if (process.env.NODE_ENV === 'development') {
    console.log('[CardID] Matching account:', {
      name: account.name,
      institution: account.institution,
      normalizedText: normalizeText(`${account.institution ?? ''} ${account.name}`),
    })
  }

  const accountText = normalizeText(
    `${account.institution ?? ''} ${account.name}`
  )

  let bestMatch: { program: ProgramWithBenefits; confidence: number; reason: string } | null = null

  for (const program of programs) {
    const patterns = (program.plaidPatterns as string[] | null) ?? []
    const issuerLower = normalizeText(program.issuer)
    const nameLower = normalizeText(program.name)

    // Check plaid patterns first (highest confidence)
    for (const pattern of patterns) {
      if (accountText.includes(normalizeText(pattern))) {
        const confidence = 0.95
        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = {
            program,
            confidence,
            reason: `Account name matches "${pattern}"`,
          }
        }
      }
    }

    // Check issuer + card name match
    if (accountText.includes(issuerLower) && accountText.includes(nameLower)) {
      const confidence = 0.9
      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = {
          program,
          confidence,
          reason: `Matches ${program.issuer} ${program.name}`,
        }
      }
    }

    // Check institution match + partial name
    if (account.institution) {
      const instLower = normalizeText(account.institution)
      if (instLower.includes(issuerLower) || issuerLower.includes(instLower)) {
        // Institution matches issuer — check for name keywords
        const nameWords = nameLower.split(/\s+/).filter((w) => w.length > 2)
        const matchedWords = nameWords.filter((w) => accountText.includes(w))
        if (matchedWords.length > 0) {
          const confidence = 0.7 + (matchedWords.length / nameWords.length) * 0.2
          if (!bestMatch || confidence > bestMatch.confidence) {
            bestMatch = {
              program,
              confidence,
              reason: `${account.institution} card matching "${matchedWords.join(', ')}"`,
            }
          }
        }
      }
    }
  }

  // Tier 4: Institution-only match for credit cards
  // If the Plaid institution matches a known card issuer, return the issuer's
  // most popular card program as a low-confidence suggestion
  if (!bestMatch || bestMatch.confidence < 0.45) {
    const institutionName = normalizeText(account.institution || '')
    if (institutionName) {
      const issuerMatches = programs.filter((program) => {
        const issuer = normalizeText(program.issuer)
        return institutionName.includes(issuer) || issuer.includes(institutionName)
      })

      if (issuerMatches.length > 0) {
        // Sort by annual fee descending as a proxy for "most likely" — premium cards
        // are more commonly identified
        const sorted = issuerMatches.sort((a, b) => (b.annualFee || 0) - (a.annualFee || 0))
        bestMatch = {
          program: sorted[0],
          confidence: 0.5,
          reason: `Issuer match: ${account.institution} is a ${sorted[0].issuer} card. Please confirm which card this is.`,
        }
      }
    }
  }

  if (!bestMatch || bestMatch.confidence < 0.45) return null

  return {
    accountId: account.id,
    accountName: account.name,
    institution: account.institution,
    suggestedProgram: {
      id: bestMatch.program.id,
      issuer: bestMatch.program.issuer,
      name: bestMatch.program.name,
      tier: bestMatch.program.tier as CardSuggestion['suggestedProgram']['tier'],
      annualFee: bestMatch.program.annualFee,
      rewardsCurrency: bestMatch.program.rewardsCurrency,
      signUpBonus: bestMatch.program.signUpBonus,
      foreignTxFee: bestMatch.program.foreignTxFee,
      isActive: bestMatch.program.isActive,
      plaidPatterns: bestMatch.program.plaidPatterns as string[] | null,
      benefits: bestMatch.program.benefits.map((b) => ({
        id: b.id,
        cardProgramId: bestMatch!.program.id,
        name: b.name,
        type: b.type,
        category: b.category,
        rewardRate: b.rewardRate,
        rewardUnit: b.rewardUnit,
        maxReward: b.maxReward,
        creditAmount: b.creditAmount,
        creditCycle: b.creditCycle as CardSuggestion['suggestedProgram']['benefits'] extends Array<infer T> ? T extends { creditCycle: infer C } ? C : never : never,
        description: b.description,
        terms: b.terms,
        isActive: b.isActive,
        eligibleMerchants: b.eligibleMerchants as string[] | null,
        merchantMatchType: b.merchantMatchType,
        creditMerchantPatterns: b.creditMerchantPatterns as string[] | null,
        isTransactionTrackable: b.isTransactionTrackable,
      })),
    },
    confidence: bestMatch.confidence,
    matchReason: bestMatch.reason,
  }
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
}
