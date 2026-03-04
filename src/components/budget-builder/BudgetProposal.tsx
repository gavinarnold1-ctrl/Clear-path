'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { BudgetProposal as BudgetProposalType } from '@/lib/budget-builder'
import type { ProfileSummary, GoalSummary, BuilderMode } from './BudgetBuilderCTA'
import ProposalFixedSection from './ProposalFixedSection'
import ProposalFlexibleSection from './ProposalFlexibleSection'
import ProposalAnnualSection from './ProposalAnnualSection'
import ProposalSummary from './ProposalSummary'

interface Props {
  initialProposal: BudgetProposalType
  profileSummary: ProfileSummary
  goalSummary: GoalSummary | null
  mode: BuilderMode
  onCancel: () => void
}

export default function BudgetProposal({ initialProposal, profileSummary, goalSummary, mode, onCancel }: Props) {
  const router = useRouter()
  const [proposal, setProposal] = useState<BudgetProposalType>(initialProposal)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleApply() {
    setApplying(true)
    setError(null)
    try {
      const res = await fetch('/api/budgets/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal, mode }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to apply budget')
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setApplying(false)
    }
  }

  const totalItems = proposal.fixed.length + proposal.flexible.length + proposal.annual.length

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-fjord">Review Budget Proposal</h2>
          <p className="mt-1 text-sm text-stone">
            Edit amounts, add missing items, remove what you don&apos;t want, then apply.
          </p>
          {goalSummary && (
            <p className="mt-1 text-xs text-pine">
              Optimized for your goal: {goalSummary.goalLabel}
            </p>
          )}
        </div>
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
      </div>

      <div className="mb-6">
        <ProposalSummary proposal={proposal} profileSummary={profileSummary} goalSummary={goalSummary} />
      </div>

      <ProposalFixedSection
        items={proposal.fixed}
        onChange={(fixed) => setProposal((p) => ({ ...p, fixed }))}
      />

      <ProposalFlexibleSection
        items={proposal.flexible}
        onChange={(flexible) => setProposal((p) => ({ ...p, flexible }))}
      />

      <ProposalAnnualSection
        items={proposal.annual}
        onChange={(annual) => setProposal((p) => ({ ...p, annual }))}
      />

      {error && (
        <div className="mb-4 rounded-lg border border-ember/30 bg-ember/10 px-4 py-2 text-sm text-ember">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-mist pt-4">
        <p className="text-sm text-stone">
          {totalItems} budget item{totalItems !== 1 ? 's' : ''} will be created
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={applying || totalItems === 0}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {applying ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Applying...
              </>
            ) : (
              'Apply budget'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
