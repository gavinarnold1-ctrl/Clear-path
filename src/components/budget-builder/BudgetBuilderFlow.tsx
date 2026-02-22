'use client'

import { useState } from 'react'
import type { BudgetProposal as BudgetProposalType } from '@/lib/budget-builder'
import BudgetBuilderCTA, { type ProfileSummary } from './BudgetBuilderCTA'
import BudgetProposal from './BudgetProposal'

interface Props {
  hasBudgets: boolean
}

export default function BudgetBuilderFlow({ hasBudgets }: Props) {
  const [proposal, setProposal] = useState<BudgetProposalType | null>(null)
  const [profileSummary, setProfileSummary] = useState<ProfileSummary | null>(null)

  function handleProposalReady(p: BudgetProposalType, ps: ProfileSummary) {
    setProposal(p)
    setProfileSummary(ps)
  }

  function handleCancel() {
    setProposal(null)
    setProfileSummary(null)
  }

  if (proposal && profileSummary) {
    return (
      <BudgetProposal
        initialProposal={proposal}
        profileSummary={profileSummary}
        onCancel={handleCancel}
      />
    )
  }

  return <BudgetBuilderCTA hasBudgets={hasBudgets} onProposalReady={handleProposalReady} />
}
