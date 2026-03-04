'use client'

import { useState } from 'react'
import type { BudgetProposal as BudgetProposalType } from '@/lib/budget-builder'
import BudgetBuilderCTA, { type ProfileSummary, type GoalSummary, type BuilderMode } from './BudgetBuilderCTA'
import BudgetProposal from './BudgetProposal'

interface Props {
  hasBudgets: boolean
}

export default function BudgetBuilderFlow({ hasBudgets }: Props) {
  const [proposal, setProposal] = useState<BudgetProposalType | null>(null)
  const [profileSummary, setProfileSummary] = useState<ProfileSummary | null>(null)
  const [goalSummary, setGoalSummary] = useState<GoalSummary | null>(null)
  const [builderMode, setBuilderMode] = useState<BuilderMode>('merge')

  function handleProposalReady(p: BudgetProposalType, ps: ProfileSummary, gs: GoalSummary | null, mode: BuilderMode) {
    setProposal(p)
    setProfileSummary(ps)
    setGoalSummary(gs)
    setBuilderMode(mode)
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
        mode={builderMode}
        onCancel={handleCancel}
      />
    )
  }

  return <BudgetBuilderCTA hasBudgets={hasBudgets} onProposalReady={handleProposalReady} />
}
