'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { CardSuggestion, CardProgram } from '@/types'
import { formatCurrency } from '@/lib/utils'

export default function CardIdentification() {
  const router = useRouter()
  const [suggestions, setSuggestions] = useState<CardSuggestion[]>([])
  const [programs, setPrograms] = useState<CardProgram[]>([])
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState<string | null>(null)
  const [manualSelect, setManualSelect] = useState<string | null>(null) // accountId for manual selection
  const [error, setError] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [assignedCount, setAssignedCount] = useState(0)

  useEffect(() => {
    fetch('/api/cards/suggestions')
      .then((res) => res.json())
      .then((data) => {
        setSuggestions(data.suggestions ?? [])
        setPrograms(data.programs ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading || dismissed || suggestions.length === 0) return null

  async function assignCard(accountId: string, cardProgramId: string) {
    setAssigning(accountId)
    setError(null)
    try {
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, cardProgramId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to assign card')
      }
      setSuggestions((prev) => prev.filter((s) => s.accountId !== accountId))
      setManualSelect(null)
      setAssignedCount((c) => c + 1)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign card')
    } finally {
      setAssigning(null)
    }
  }

  const TIER_LABELS: Record<string, string> = {
    BASIC: 'Basic',
    MID: 'Mid-Tier',
    PREMIUM: 'Premium',
    ULTRA_PREMIUM: 'Ultra Premium',
  }

  return (
    <div className="mb-6 rounded-xl border border-birch/50 bg-birch/10 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-fjord">
            Identify Your Credit Cards
          </h3>
          <p className="text-xs text-stone">
            Match your cards to unlock rewards tracking and benefit reminders.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/accounts/benefits"
            className="text-xs text-pine hover:underline"
          >
            View Benefits
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className="text-xs text-stone hover:text-fjord"
          >
            Dismiss
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-ember/30 bg-ember/10 px-3 py-1.5 text-xs text-ember">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            dismiss
          </button>
        </div>
      )}

      {assignedCount > 0 && suggestions.length === 0 && (
        <div className="rounded-lg border border-pine/30 bg-pine/10 px-3 py-2 text-xs text-pine">
          All cards identified!{' '}
          <Link href="/accounts/benefits" className="font-medium underline">
            View your benefits dashboard
          </Link>
        </div>
      )}

      <div className="space-y-2">
        {suggestions.map((suggestion) => (
          <div
            key={suggestion.accountId}
            className="rounded-lg border border-mist bg-snow p-3"
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fjord">
                  {suggestion.accountName}
                  {suggestion.institution && (
                    <span className="ml-1 text-xs text-stone">
                      ({suggestion.institution})
                    </span>
                  )}
                </p>
                {manualSelect !== suggestion.accountId && (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="rounded-badge bg-pine/10 px-1.5 py-0.5 text-[10px] font-medium text-pine">
                      {Math.round(suggestion.confidence * 100)}% match
                    </span>
                    <span className="text-xs text-stone">
                      {suggestion.suggestedProgram.issuer}{' '}
                      {suggestion.suggestedProgram.name}
                    </span>
                    <span className="rounded-badge bg-frost px-1.5 py-0.5 text-[10px] text-stone">
                      {TIER_LABELS[suggestion.suggestedProgram.tier]}
                    </span>
                    {suggestion.suggestedProgram.annualFee > 0 && (
                      <span className="text-[10px] text-stone">
                        {formatCurrency(suggestion.suggestedProgram.annualFee)}/yr
                      </span>
                    )}
                  </div>
                )}
              </div>

              {manualSelect !== suggestion.accountId ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setManualSelect(suggestion.accountId)}
                    className="text-xs text-stone hover:text-fjord"
                  >
                    Different card
                  </button>
                  <button
                    onClick={() =>
                      assignCard(
                        suggestion.accountId,
                        suggestion.suggestedProgram.id
                      )
                    }
                    disabled={assigning === suggestion.accountId}
                    className="rounded-button bg-fjord px-3 py-1 text-xs font-medium text-snow hover:bg-midnight disabled:opacity-50"
                  >
                    {assigning === suggestion.accountId
                      ? 'Assigning...'
                      : 'Confirm'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setManualSelect(null)}
                  className="text-xs text-stone hover:text-fjord"
                >
                  Cancel
                </button>
              )}
            </div>

            {/* Manual card selection dropdown */}
            {manualSelect === suggestion.accountId && (
              <div className="mt-2 border-t border-mist pt-2">
                <p className="mb-1 text-xs text-stone">
                  Select the correct card:
                </p>
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {programs.map((program) => (
                    <button
                      key={program.id}
                      onClick={() =>
                        assignCard(suggestion.accountId, program.id)
                      }
                      disabled={assigning === suggestion.accountId}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-frost disabled:opacity-50"
                    >
                      <span className="font-medium text-fjord">
                        {program.issuer} {program.name}
                      </span>
                      <span className="text-stone">
                        {program.annualFee > 0
                          ? formatCurrency(program.annualFee) + '/yr'
                          : 'No fee'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Benefits preview */}
            {manualSelect !== suggestion.accountId &&
              suggestion.suggestedProgram.benefits &&
              suggestion.suggestedProgram.benefits.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {suggestion.suggestedProgram.benefits
                    .filter(
                      (b) =>
                        b.type === 'cashback' || b.type === 'points_multiplier'
                    )
                    .slice(0, 4)
                    .map((b) => (
                      <span
                        key={b.id}
                        className="rounded-badge bg-frost px-1.5 py-0.5 text-[10px] text-stone"
                      >
                        {b.description}
                      </span>
                    ))}
                </div>
              )}
          </div>
        ))}
      </div>
    </div>
  )
}
