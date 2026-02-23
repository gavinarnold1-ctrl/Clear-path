'use client'

import { useState } from 'react'
import type { BudgetProposal } from '@/lib/budget-builder'

interface BudgetBuilderCTAProps {
  hasBudgets: boolean
  onProposalReady: (proposal: BudgetProposal, profileSummary: ProfileSummary) => void
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

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/budgets/generate', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to generate budget')
      }
      const data = await res.json()
      onProposalReady(data.proposal, data.profile)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setGenerating(false)
    }
  }

  if (hasBudgets) {
    return (
      <button
        type="button"
        onClick={handleGenerate}
        disabled={generating}
        className="btn-secondary flex items-center gap-2 disabled:opacity-50"
      >
        {generating ? (
          <>
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Analyzing...
          </>
        ) : (
          <>
            <span>&#x2728;</span>
            AI Budget Builder
          </>
        )}
      </button>
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

      <button
        type="button"
        onClick={handleGenerate}
        disabled={generating}
        className="btn-primary flex items-center gap-2 disabled:opacity-50"
      >
        {generating ? (
          <>
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Analyzing your spending...
          </>
        ) : (
          <>
            <span>&#x2728;</span>
            Generate budget proposal
          </>
        )}
      </button>

      {generating && (
        <p className="mt-3 text-xs text-stone">
          This may take 15-30 seconds while we analyze your transactions...
        </p>
      )}
    </div>
  )
}
