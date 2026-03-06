'use client'

import { useState } from 'react'
import type { GoalTarget, PrimaryGoal } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { monthsBetween, projectedDate } from '@/lib/goal-targets'

interface GoalProgressCardProps {
  goal: PrimaryGoal
  goalLabel: string
  target: GoalTarget | null
  trueRemaining: number
}

export default function GoalProgressCard({
  goal,
  goalLabel,
  target,
  trueRemaining,
}: GoalProgressCardProps) {
  if (!target) {
    return <GoalTargetProposal goal={goal} goalLabel={goalLabel} />
  }

  const progress = target.currentValue !== undefined && target.targetValue > 0
    ? Math.min(100, Math.round((target.currentValue / target.targetValue) * 100))
    : 0

  const now = new Date().toISOString()
  const monthsElapsed = monthsBetween(target.startDate, now)
  const monthsTotal = monthsBetween(target.startDate, target.targetDate)
  const expectedProgress = monthsTotal > 0 ? Math.min(100, Math.round((monthsElapsed / monthsTotal) * 100)) : 0
  const pace: 'ahead' | 'on-track' | 'behind' =
    progress >= expectedProgress + 5 ? 'ahead' :
    progress >= expectedProgress - 5 ? 'on-track' : 'behind'

  const trueRemainingContext = getTrueRemainingContext(goal, trueRemaining, target)

  return (
    <div className="card mb-6">
      {/* Goal label + description */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <span className="text-xs font-medium uppercase tracking-wider text-stone">
            Your Goal: {goalLabel}
          </span>
          <h2 className="text-lg font-semibold text-fjord">{target.description}</h2>
        </div>
        <PaceBadge pace={pace} />
      </div>

      {/* Progress bar */}
      <div className="mb-2">
        <div className="flex justify-between text-sm text-stone">
          <span>{formatMetricValue(target, target.currentValue ?? 0)}</span>
          <span>{formatMetricValue(target, target.targetValue)}</span>
        </div>
        <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-birch/30">
          <div
            className="h-full rounded-full bg-pine transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-1 text-center text-sm font-medium text-fjord">{progress}%</div>
      </div>

      {/* Pace + projection */}
      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-xs text-stone">Monthly target</span>
          <p className="font-semibold text-fjord">
            {target.metric === 'categorization_pct'
              ? `${target.targetValue}%`
              : formatCurrency(target.monthlyNeeded ?? 0)}
          </p>
        </div>
        <div>
          <span className="text-xs text-stone">Projected completion</span>
          <p className="font-semibold text-fjord">{projectedDate(target)}</p>
        </div>
      </div>

      {/* True Remaining — contextualized */}
      <div className="mt-4 rounded-lg bg-frost/50 px-4 py-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-stone">True Remaining</span>
          <span className="text-lg font-bold text-fjord">{formatCurrency(trueRemaining)}</span>
        </div>
        <p className="mt-1 text-xs text-stone">{trueRemainingContext}</p>
      </div>
    </div>
  )
}

function formatMetricValue(target: GoalTarget, value: number): string {
  if (target.metric === 'categorization_pct' || target.metric === 'savings_rate') {
    return `${Math.round(value)}%`
  }
  return formatCurrency(value)
}

function getTrueRemainingContext(goal: PrimaryGoal, remaining: number, target: GoalTarget): string {
  const monthly = target.monthlyNeeded ?? 0
  switch (goal) {
    case 'save_more':
      return remaining >= monthly
        ? `On pace \u2014 ${formatCurrency(remaining)} available, ${formatCurrency(monthly)} needed for savings target`
        : `${formatCurrency(monthly - remaining)} short of monthly savings target`
    case 'pay_off_debt':
      return remaining >= monthly
        ? `${formatCurrency(remaining)} available \u2014 directing ${formatCurrency(monthly)} to debt gets you to payoff sooner`
        : `${formatCurrency(monthly - remaining)} short of extra debt payment goal`
    case 'spend_smarter':
      return `${formatCurrency(remaining)} remaining \u2014 ${remaining > 0 ? 'spending is under control' : 'review flexible categories for optimizations'}`
    case 'gain_visibility':
      return `${formatCurrency(remaining)} remaining this month`
    case 'build_wealth':
      return remaining >= monthly
        ? `${formatCurrency(remaining)} available for wealth-building \u2014 savings + debt reduction this month`
        : `${formatCurrency(monthly - remaining)} short of monthly wealth-building target`
  }
}

function PaceBadge({ pace }: { pace: 'ahead' | 'on-track' | 'behind' }) {
  const styles = {
    ahead: 'bg-pine/10 text-pine',
    'on-track': 'bg-pine/10 text-pine',
    behind: 'bg-ember/10 text-ember',
  }
  const labels = { ahead: 'Ahead of pace', 'on-track': 'On track', behind: 'Behind pace' }
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${styles[pace]}`}>
      {labels[pace]}
    </span>
  )
}

function GoalTargetProposal({ goal, goalLabel }: { goal: PrimaryGoal; goalLabel: string }) {
  const [proposing, setProposing] = useState(false)
  const [proposal, setProposal] = useState<GoalTarget | null>(null)
  const [accepted, setAccepted] = useState(false)

  async function proposeTarget() {
    setProposing(true)
    try {
      const res = await fetch('/api/profile/goal-target', { method: 'POST' })
      const data = await res.json()
      setProposal(data.goalTarget)
    } finally {
      setProposing(false)
    }
  }

  async function acceptTarget() {
    if (!proposal) return
    await fetch('/api/profile/goal-target', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goalTarget: proposal }),
    })
    setAccepted(true)
    window.location.reload()
  }

  if (accepted) return null

  if (proposal) {
    return (
      <div className="card mb-6 border-pine/30 bg-pine/5">
        <h3 className="text-lg font-semibold text-fjord">
          Suggested target for &ldquo;{goalLabel}&rdquo;
        </h3>
        <p className="mt-2 text-fjord">{proposal.description}</p>
        {proposal.monthlyNeeded != null && proposal.monthlyNeeded > 0 && (
          <p className="mt-1 text-sm text-stone">
            Monthly target: {formatCurrency(proposal.monthlyNeeded)}
          </p>
        )}
        <div className="mt-4 flex gap-3">
          <button onClick={acceptTarget} className="btn-primary">
            Set This Target
          </button>
          <button onClick={() => setProposal(null)} className="btn-secondary">
            Dismiss
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="card mb-6">
      <h3 className="text-lg font-semibold text-fjord">
        Set a target for &ldquo;{goalLabel}&rdquo;
      </h3>
      <p className="mt-1 text-sm text-stone">
        A concrete target turns your goal into a destination with visible progress.
      </p>
      <button onClick={proposeTarget} className="btn-primary mt-4" disabled={proposing}>
        {proposing ? 'Analyzing your spending...' : 'Suggest a Target'}
      </button>
    </div>
  )
}
