'use client'

import { useState } from 'react'
import type { BudgetProposal as BudgetProposalType } from '@/lib/budget-builder'
import BudgetBuilderCTA, { type ProfileSummary, type GoalSummary } from './BudgetBuilderCTA'
import BudgetProposal from './BudgetProposal'

interface Props {
  hasBudgets: boolean
}

export default function BudgetBuilderFlow({ hasBudgets }: Props) {
  const [proposal, setProposal] = useState<BudgetProposalType | null>(null)
  const [profileSummary, setProfileSummary] = useState<ProfileSummary | null>(null)
  const [goalSummary, setGoalSummary] = useState<GoalSummary | null>(null)

  function handleProposalReady(p: BudgetProposalType, ps: ProfileSummary, gs: GoalSummary | null) {
    setProposal(p)
    setProfileSummary(ps)
    setGoalSummary(gs)
  }

  function handleCancel() {
    setProposal(null)
    setProfileSummary(null)
    setGoalSummary(null)
  }

  if (proposal && profileSummary) {
    return (
      <BudgetProposal
        initialProposal={proposal}
        profileSummary={profileSummary}
        goalSummary={goalSummary}
        onCancel={handleCancel}
      />
    )
  }

  return <BudgetBuilderCTA hasBudgets={hasBudgets} onProposalReady={handleProposalReady} />
}
