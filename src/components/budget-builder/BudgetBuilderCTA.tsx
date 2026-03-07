'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import type { BudgetProposal } from '@/lib/budget-builder'

export type BuilderMode = 'replace' | 'merge'

export interface GoalSummary {
  goalLabel: string
  primaryGoal: string
}

interface BudgetBuilderCTAProps {
  hasBudgets: boolean
  onProposalReady: (proposal: BudgetProposal, profileSummary: ProfileSummary, goalSummary: GoalSummary | null, mode: BuilderMode) => void
}

export interface ProfileSummary {
  totalMonthlyIncome: number
  averageMonthlyExpenses: number
  monthsOfData: number
  totalTransactions: number
  savingsRate: number
  incomeStreams: number
  detectedFixed: number
  variableCategories: number
}

export default function BudgetBuilderCTA({ hasBudgets, onProposalReady }: BudgetBuilderCTAProps) {
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const modeRef = useRef<BuilderMode>('merge')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/budgets/generate/status')
      if (!res.ok) return
      const data = await res.json()

      if (data.status === 'complete') {
        stopPolling()
        setGenerating(false)
        onProposalReady(data.proposal, data.profile, data.goalContext ?? null, modeRef.current)
      } else if (data.status === 'error') {
        stopPolling()
        setGenerating(false)
        setError(data.error || 'Something went wrong')
      }
      // If 'pending' or 'idle', keep polling
    } catch {
      // Network error — keep polling
    }
  }, [onProposalReady, stopPolling])

  // On mount, check if there's already a pending generation (user navigated away and came back)
  useEffect(() => {
    async function checkPending() {
      try {
        const res = await fetch('/api/budgets/generate/status')
        if (!res.ok) return
        const data = await res.json()
        if (data.status === 'pending') {
          setGenerating(true)
          pollRef.current = setInterval(pollStatus, 3000)
        } else if (data.status === 'complete') {
          onProposalReady(data.proposal, data.profile, data.goalContext ?? null, modeRef.current)
        }
      } catch {
        // Ignore
      }
    }
    checkPending()
    return stopPolling
  }, [pollStatus, onProposalReady, stopPolling])

  async function handleGenerate(selectedMode: BuilderMode = 'merge') {
    modeRef.current = selectedMode
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/budgets/generate', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to generate budget')
      }
      // Start polling
      pollRef.current = setInterval(pollStatus, 3000)
    } catch (err) {
      setGenerating(false)
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  if (hasBudgets) {
    return (
      <div className="relative">
        <Button
          variant="secondary"
          type="button"
          onClick={() => setShowMenu(prev => !prev)}
          disabled={generating}
          loading={generating}
          loadingText="AI Budget Builder (working...)"
        >
          <span>&#x2728;</span>
          AI Budget Builder
        </Button>
        {showMenu && !generating && (
          <div className="absolute right-0 z-10 mt-1 w-56 rounded-card border border-mist bg-snow shadow-lg">
            <button
              type="button"
              onClick={() => { setShowMenu(false); handleGenerate('replace') }}
              className="w-full px-4 py-2.5 text-left text-sm hover:bg-frost"
            >
              <p className="font-medium text-fjord">Regenerate all</p>
              <p className="text-xs text-stone">Replace existing budgets</p>
            </button>
            <button
              type="button"
              onClick={() => { setShowMenu(false); handleGenerate('merge') }}
              className="w-full border-t border-mist px-4 py-2.5 text-left text-sm hover:bg-frost"
            >
              <p className="font-medium text-fjord">Add missing</p>
              <p className="text-xs text-stone">Fill gaps, keep existing</p>
            </button>
            <button
              type="button"
              onClick={() => setShowMenu(false)}
              className="w-full border-t border-mist px-4 py-2.5 text-left text-sm text-stone hover:bg-frost"
            >
              Dismiss
            </button>
          </div>
        )}
        {error && (
          <div className="absolute right-0 mt-1 w-56 rounded-lg border border-ember/30 bg-ember/10 px-3 py-2 text-xs text-ember">
            {error}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="card flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 text-5xl">&#x1F4CA;</div>
      <h2 className="mb-2 text-lg font-semibold text-fjord">Build your budget with AI</h2>
      <p className="mb-1 max-w-md text-sm text-stone">
        We&apos;ll analyze your transaction history to detect recurring bills, categorize your
        spending, and propose a complete three-tier budget (Fixed, Flexible, Annual).
      </p>
      <p className="mb-6 max-w-md text-xs text-stone">
        You&apos;ll review and edit everything before it&apos;s applied.
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-ember/30 bg-ember/10 px-4 py-2 text-sm text-ember">
          {error}
        </div>
      )}

      <Button
        type="button"
        onClick={() => handleGenerate('merge')}
        disabled={generating}
        loading={generating}
        loadingText="AI Budget Builder is working..."
      >
        <span>&#x2728;</span>
        Generate budget proposal
      </Button>

      {generating && (
        <p className="mt-3 text-xs text-stone animate-pulse">
          Analyzing your transactions with AI... You can navigate away and come back.
        </p>
      )}
    </div>
  )
}
