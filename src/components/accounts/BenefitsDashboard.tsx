'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'

interface BenefitInfo {
  id: string
  name: string
  type: string
  category: string | null
  rewardRate: number | null
  rewardUnit: string | null
  maxReward: number | null
  creditAmount: number | null
  creditCycle: string | null
  description: string
  terms: string | null
}

interface BenefitTracking {
  id: string
  cardBenefitId: string
  usedAmount: number
  isOptedIn: boolean
  notes: string | null
  benefitName: string
  benefitType: string
  creditAmount: number | null
  creditCycle: string | null
}

interface CardData {
  id: string
  nickname: string | null
  lastFourDigits: string | null
  isActive: boolean
  accountId: string | null
  accountName: string | null
  accountBalance: number | null
  program: {
    id: string
    issuer: string
    name: string
    tier: string
    annualFee: number
    rewardsCurrency: string | null
    foreignTxFee: number
    benefits: BenefitInfo[]
  }
  benefitTracking: BenefitTracking[]
}

interface Props {
  cards: CardData[]
}

const TIER_COLORS: Record<string, string> = {
  BASIC: 'bg-mist text-stone',
  MID: 'bg-lichen/20 text-pine',
  PREMIUM: 'bg-birch/30 text-fjord',
  ULTRA_PREMIUM: 'bg-fjord/10 text-fjord',
}

const TIER_LABELS: Record<string, string> = {
  BASIC: 'Basic',
  MID: 'Mid-Tier',
  PREMIUM: 'Premium',
  ULTRA_PREMIUM: 'Ultra Premium',
}

const CYCLE_LABELS: Record<string, string> = {
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  ANNUALLY: 'Annually',
  CALENDAR_YEAR: 'Calendar Year',
  CARDMEMBER_YEAR: 'Cardmember Year',
}

const BENEFIT_TYPE_ICONS: Record<string, string> = {
  cashback: 'Cash Back',
  points_multiplier: 'Points',
  statement_credit: 'Credit',
  insurance: 'Insurance',
  perk: 'Perk',
}

export default function BenefitsDashboard({ cards }: Props) {
  const router = useRouter()
  const [expandedCard, setExpandedCard] = useState<string | null>(
    cards.length === 1 ? cards[0].id : null
  )
  const [removing, setRemoving] = useState<string | null>(null)

  // Summary stats
  const totalAnnualFees = cards.reduce((sum, c) => sum + c.program.annualFee, 0)
  const totalCredits = cards.reduce((sum, c) => {
    return sum + c.program.benefits
      .filter((b) => b.type === 'statement_credit' && b.creditAmount)
      .reduce((s, b) => s + (b.creditAmount ?? 0), 0)
  }, 0)
  const netCost = totalAnnualFees - totalCredits

  async function removeCard(cardId: string) {
    if (!confirm('Remove this card identification? Benefits tracking will be lost.')) return
    setRemoving(cardId)
    try {
      const res = await fetch(`/api/cards/${cardId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to remove card')
      router.refresh()
    } catch {
      // Show inline error handled by page reload
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div>
      {/* Summary */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-xs text-stone">Cards Tracked</p>
          <p className="text-2xl font-bold text-fjord">{cards.length}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-stone">Total Annual Fees</p>
          <p className="text-2xl font-bold text-fjord">
            {formatCurrency(totalAnnualFees)}
          </p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-stone">Available Credits</p>
          <p className="text-2xl font-bold text-pine">
            {formatCurrency(totalCredits)}
          </p>
          {netCost !== totalAnnualFees && (
            <p className="text-[10px] text-stone">
              Net: {netCost > 0 ? formatCurrency(netCost) : `+${formatCurrency(Math.abs(netCost))}`}
            </p>
          )}
        </div>
      </div>

      {/* Card list */}
      <div className="space-y-4">
        {cards.map((card) => {
          const isExpanded = expandedCard === card.id
          const rewardBenefits = card.program.benefits.filter(
            (b) => b.type === 'cashback' || b.type === 'points_multiplier'
          )
          const creditBenefits = card.program.benefits.filter(
            (b) => b.type === 'statement_credit'
          )
          const perkBenefits = card.program.benefits.filter(
            (b) => b.type === 'insurance' || b.type === 'perk'
          )

          return (
            <div key={card.id} className="card">
              {/* Card header */}
              <button
                onClick={() =>
                  setExpandedCard(isExpanded ? null : card.id)
                }
                className="flex w-full items-center justify-between text-left"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-fjord">
                      {card.program.issuer} {card.program.name}
                    </h3>
                    <span
                      className={`rounded-badge px-1.5 py-0.5 text-[10px] font-medium ${
                        TIER_COLORS[card.program.tier] ?? 'bg-mist text-stone'
                      }`}
                    >
                      {TIER_LABELS[card.program.tier]}
                    </span>
                  </div>
                  <p className="text-xs text-stone">
                    {card.accountName && (
                      <span>{card.accountName}</span>
                    )}
                    {card.lastFourDigits && (
                      <span>
                        {card.accountName ? ' · ' : ''}
                        ····{card.lastFourDigits}
                      </span>
                    )}
                    {card.program.annualFee > 0 && (
                      <span>
                        {(card.accountName || card.lastFourDigits) ? ' · ' : ''}
                        {formatCurrency(card.program.annualFee)}/yr fee
                      </span>
                    )}
                    {card.program.annualFee === 0 && (
                      <span>
                        {(card.accountName || card.lastFourDigits) ? ' · ' : ''}
                        No annual fee
                      </span>
                    )}
                    {card.program.foreignTxFee === 0 && (
                      <span> · No foreign tx fee</span>
                    )}
                  </p>
                </div>
                <span className="text-sm text-stone">
                  {isExpanded ? '▲' : '▼'}
                </span>
              </button>

              {/* Quick rewards preview when collapsed */}
              {!isExpanded && rewardBenefits.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {rewardBenefits.slice(0, 5).map((b) => (
                    <span
                      key={b.id}
                      className="rounded-badge bg-frost px-1.5 py-0.5 text-[10px] text-stone"
                    >
                      {b.description}
                    </span>
                  ))}
                </div>
              )}

              {/* Expanded details */}
              {isExpanded && (
                <div className="mt-4 space-y-4">
                  {/* Rewards */}
                  {rewardBenefits.length > 0 && (
                    <div>
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone">
                        Rewards
                      </h4>
                      <div className="space-y-1">
                        {rewardBenefits.map((b) => (
                          <div
                            key={b.id}
                            className="flex items-center justify-between rounded-lg bg-frost px-3 py-2"
                          >
                            <div>
                              <p className="text-sm font-medium text-fjord">
                                {b.name}
                              </p>
                              <p className="text-xs text-stone">
                                {b.description}
                              </p>
                            </div>
                            <div className="text-right">
                              {b.rewardRate && (
                                <p className="text-sm font-bold text-pine">
                                  {b.rewardUnit === 'percent'
                                    ? `${(b.rewardRate * 100).toFixed(
                                        b.rewardRate * 100 === Math.floor(b.rewardRate * 100) ? 0 : 1
                                      )}%`
                                    : `${b.rewardRate}x`}
                                </p>
                              )}
                              {b.category && (
                                <p className="text-[10px] text-stone">
                                  {b.category}
                                </p>
                              )}
                              {b.maxReward && (
                                <p className="text-[10px] text-stone">
                                  Max: {formatCurrency(b.maxReward)}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Statement Credits */}
                  {creditBenefits.length > 0 && (
                    <div>
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone">
                        Statement Credits
                      </h4>
                      <div className="space-y-1">
                        {creditBenefits.map((b) => {
                          const tracking = card.benefitTracking.find(
                            (t) => t.cardBenefitId === b.id
                          )
                          const creditAmt = b.creditAmount ?? 0
                          const used = tracking?.usedAmount ?? 0
                          const remaining = Math.max(0, creditAmt - used)
                          const pct =
                            creditAmt > 0
                              ? Math.min(100, (used / creditAmt) * 100)
                              : 0

                          return (
                            <div
                              key={b.id}
                              className="rounded-lg bg-frost px-3 py-2"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-fjord">
                                    {b.name}
                                  </p>
                                  <p className="text-xs text-stone">
                                    {b.description}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-bold text-pine">
                                    {formatCurrency(creditAmt)}
                                  </p>
                                  {b.creditCycle && (
                                    <p className="text-[10px] text-stone">
                                      {CYCLE_LABELS[b.creditCycle] ?? b.creditCycle}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {creditAmt > 0 && (
                                <div className="mt-2">
                                  <div className="flex items-center justify-between text-[10px] text-stone">
                                    <span>
                                      Used: {formatCurrency(used)}
                                    </span>
                                    <span>
                                      Remaining: {formatCurrency(remaining)}
                                    </span>
                                  </div>
                                  <div className="mt-1 h-1.5 rounded-full bg-mist">
                                    <div
                                      className="h-1.5 rounded-full bg-pine transition-all"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Perks & Insurance */}
                  {perkBenefits.length > 0 && (
                    <div>
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone">
                        Perks & Insurance
                      </h4>
                      <div className="space-y-1">
                        {perkBenefits.map((b) => (
                          <div
                            key={b.id}
                            className="flex items-center justify-between rounded-lg bg-frost px-3 py-2"
                          >
                            <div>
                              <p className="text-sm font-medium text-fjord">
                                {b.name}
                              </p>
                              <p className="text-xs text-stone">
                                {b.description}
                              </p>
                            </div>
                            <span className="rounded-badge bg-birch/30 px-1.5 py-0.5 text-[10px] text-fjord">
                              {BENEFIT_TYPE_ICONS[b.type] ?? b.type}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Account balance */}
                  {card.accountBalance !== null && (
                    <div className="rounded-lg border border-mist bg-snow px-3 py-2">
                      <p className="text-xs text-stone">Current Balance</p>
                      <p className="text-lg font-bold text-expense">
                        {formatCurrency(Math.abs(card.accountBalance))}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex justify-end gap-2 border-t border-mist pt-3">
                    <button
                      onClick={() => removeCard(card.id)}
                      disabled={removing === card.id}
                      className="text-xs text-stone hover:text-ember disabled:opacity-50"
                    >
                      {removing === card.id ? 'Removing...' : 'Remove card'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
