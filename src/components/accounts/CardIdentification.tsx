'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { CardSuggestion, CardProgram } from '@/types'
import { formatCurrency, normalizeAccountName } from '@/lib/utils'

interface UnidentifiedAccount {
  id: string
  name: string
  institution: string | null
}

export default function CardIdentification() {
  const router = useRouter()
  const [suggestions, setSuggestions] = useState<CardSuggestion[]>([])
  const [programs, setPrograms] = useState<CardProgram[]>([])
  const [unidentifiedAccounts, setUnidentifiedAccounts] = useState<UnidentifiedAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState<string | null>(null)
  const [manualSelect, setManualSelect] = useState<string | null>(null) // accountId for manual selection
  const [error, setError] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [assignedCount, setAssignedCount] = useState(0)

  useEffect(() => {
    fetch('/api/cards/suggestions')
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load card suggestions (${res.status})`)
        return res.json()
      })
      .then((data) => {
        setSuggestions(data.suggestions ?? [])
        setPrograms(data.programs ?? [])
        setUnidentifiedAccounts(data.unidentifiedAccounts ?? [])
      })
      .catch((err) => {
        console.error('[CardIdentification]', err)
        setError(err instanceof Error ? err.message : 'Failed to load card suggestions')
      })
      .finally(() => setLoading(false))
  }, [])

  const hasCards = suggestions.length > 0 || unidentifiedAccounts.length > 0
  if (loading || dismissed) return null
  if (error && !hasCards) {
    return (
      <div className="mb-6 rounded-xl border border-ember/20 bg-ember/5 p-4">
        <p className="text-sm font-medium text-fjord">Card Identification</p>
        <p className="mt-1 text-xs text-ember">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 text-xs font-medium text-fjord hover:text-pine"
        >
          Retry
        </button>
      </div>
    )
  }
  if (!hasCards) return null

  async function dismissCard(accountId: string) {
    try {
      const res = await fetch('/api/cards/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      })
      if (!res.ok) throw new Error('Failed to dismiss')
      setSuggestions((prev) => prev.filter((s) => s.accountId !== accountId))
      setUnidentifiedAccounts((prev) => prev.filter((a) => a.id !== accountId))
      setManualSelect(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to dismiss card')
    }
  }

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
      setUnidentifiedAccounts((prev) => prev.filter((a) => a.id !== accountId))
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

  const allDone = suggestions.length === 0 && unidentifiedAccounts.length === 0

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

      {assignedCount > 0 && allDone && (
        <div className="rounded-lg border border-pine/30 bg-pine/10 px-3 py-2 text-xs text-pine">
          All cards identified!{' '}
          <Link href="/accounts/benefits" className="font-medium underline">
            View your benefits dashboard
          </Link>
        </div>
      )}

      <div className="space-y-2">
        {/* Auto-matched suggestions */}
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
                    onClick={() => dismissCard(suggestion.accountId)}
                    className="rounded-button border border-mist px-2.5 py-1 text-xs font-medium text-stone hover:border-ember hover:text-ember"
                  >
                    Skip
                  </button>
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
              <ManualProgramList
                accountId={suggestion.accountId}
                programs={programs}
                assigning={assigning}
                onSelect={assignCard}
              />
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

        {/* Unidentified accounts without auto-match — manual selection */}
        {unidentifiedAccounts.map((account) => (
          <div
            key={account.id}
            className="rounded-lg border border-mist bg-snow p-3"
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fjord">
                  {normalizeAccountName(account.name)}
                  {account.institution && (
                    <span className="ml-1 text-xs text-stone">
                      ({account.institution})
                    </span>
                  )}
                </p>
                {manualSelect !== account.id && (
                  <p className="mt-0.5 text-xs text-stone">
                    No auto-match found — select your card program
                  </p>
                )}
              </div>

              {manualSelect !== account.id ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => dismissCard(account.id)}
                    className="rounded-button border border-mist px-2.5 py-1 text-xs font-medium text-stone hover:border-ember hover:text-ember"
                  >
                    Skip
                  </button>
                  <button
                    onClick={() => setManualSelect(account.id)}
                    className="rounded-button bg-frost px-3 py-1.5 text-xs font-medium text-pine hover:bg-pine/10 transition-colors"
                  >
                    Identify card
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

            {manualSelect === account.id && (
              <ManualProgramList
                accountId={account.id}
                programs={programs}
                assigning={assigning}
                onSelect={assignCard}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function ManualProgramList({
  accountId,
  programs,
  assigning,
  onSelect,
}: {
  accountId: string
  programs: CardProgram[]
  assigning: string | null
  onSelect: (accountId: string, programId: string) => void
}) {
  const [search, setSearch] = useState('')

  const grouped = useMemo(() => {
    const query = search.toLowerCase().trim()
    const filtered = query
      ? programs.filter(
          (p) =>
            p.issuer.toLowerCase().includes(query) ||
            p.name.toLowerCase().includes(query)
        )
      : programs

    const groups: Record<string, CardProgram[]> = {}
    for (const p of filtered) {
      ;(groups[p.issuer] ??= []).push(p)
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [programs, search])

  if (programs.length === 0) {
    return (
      <div className="mt-2 border-t border-mist pt-2">
        <p className="text-xs text-stone">
          No card programs available. Card programs may need to be seeded in the database.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-2 border-t border-mist pt-2">
      <input
        type="text"
        placeholder="Search cards..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="input mb-2 w-full py-1.5 text-xs"
      />
      <div className="max-h-48 space-y-2 overflow-y-auto">
        {grouped.length === 0 && (
          <p className="text-xs text-stone">No cards match &ldquo;{search}&rdquo;</p>
        )}
        {grouped.map(([issuer, issuerPrograms]) => (
          <div key={issuer}>
            <p className="text-[10px] font-medium text-stone">{issuer}</p>
            <div className="mt-0.5 space-y-0.5">
              {issuerPrograms.map((program) => (
                <button
                  key={program.id}
                  onClick={() => onSelect(accountId, program.id)}
                  disabled={assigning === accountId}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-frost disabled:opacity-50"
                >
                  <span className="font-medium text-fjord">{program.name}</span>
                  <span className="text-stone">
                    {program.annualFee > 0
                      ? formatCurrency(program.annualFee) + '/yr'
                      : 'No fee'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
