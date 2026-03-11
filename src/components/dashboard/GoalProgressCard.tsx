'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { GoalTarget, PrimaryGoal } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { monthsBetween, projectedDate } from '@/lib/goal-targets'
import { Button } from '@/components/ui/Button'

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

  const contextLine = getContextLine(goal, trueRemaining, target)

  return (
    <div className="rounded-card border border-mist bg-frost/30 p-4">
      {/* Compact header: goal name + badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="text-xs font-medium text-stone">{goalLabel}</span>
          <span className="mx-2 text-xs text-mist">&middot;</span>
          <span className="text-xs font-medium text-fjord">{target.description}</span>
        </div>
        <PaceBadge pace={pace} />
      </div>

      {/* Thin progress bar */}
      <div className="mt-3">
        <div className="h-1.5 w-full overflow-hidden rounded-bar bg-mist">
          <div
            className="h-full rounded-bar bg-pine transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-xs text-stone">
          <span>{formatMetricValue(target, target.currentValue ?? 0)} of {formatMetricValue(target, target.targetValue)}</span>
          <Link href="/forecast" className="font-medium text-fjord hover:underline">
            {projectedDate(target)} &rarr;
          </Link>
        </div>
      </div>

      {/* Single context sentence */}
      {contextLine && (
        <p className={`mt-2 text-xs ${contextLine.color}`}>{contextLine.text}</p>
      )}
    </div>
  )
}

function formatMetricValue(target: GoalTarget, value: number): string {
  if (target.metric === 'categorization_pct' || target.metric === 'savings_rate') {
    return `${Math.round(value)}%`
  }
  return formatCurrency(value)
}

function getContextLine(goal: PrimaryGoal, remaining: number, target: GoalTarget): { text: string; color: string } | null {
  const monthly = target.monthlyNeeded ?? 0
  if (monthly <= 0) return null

  // Compute months early/late based on projected vs target completion
  const currentValue = target.currentValue ?? 0
  const amountLeft = target.targetValue - currentValue
  let monthsDiff = 0
  if (amountLeft > 0 && remaining > 0) {
    const projectedMonths = Math.ceil(amountLeft / remaining)
    const targetMonths = monthsBetween(new Date().toISOString(), target.targetDate)
    monthsDiff = targetMonths - projectedMonths // positive = early, negative = late
  }

  if (remaining >= monthly) {
    const paceNote = monthsDiff > 2
      ? ` — on track to finish ${monthsDiff} months early`
      : monthsDiff > 0
        ? ' — slightly ahead of schedule'
        : ''
    switch (goal) {
      case 'save_more':
        return { text: `Saving ${formatCurrency(remaining)}/mo toward ${formatCurrency(monthly)}/mo target${paceNote}`, color: 'text-pine' }
      case 'pay_off_debt':
        return { text: `${formatCurrency(remaining)} available for extra debt payments${paceNote}`, color: 'text-pine' }
      default:
        return { text: `${formatCurrency(remaining)} remaining after commitments${paceNote}`, color: 'text-fjord' }
    }
  }

  const shortfall = monthly - remaining
  const behindNote = monthsDiff < -2
    ? ` — you need ${formatCurrency(monthly)}/mo to hit your target date`
    : ''
  return { text: `${formatCurrency(shortfall)} short of ${formatCurrency(monthly)}/mo target${behindNote}`, color: 'text-ember' }
}

function PaceBadge({ pace }: { pace: 'ahead' | 'on-track' | 'behind' }) {
  const styles = {
    ahead: 'bg-pine/10 text-pine',
    'on-track': 'bg-pine/10 text-pine',
    behind: 'bg-ember/10 text-ember',
  }
  const labels = { ahead: 'Ahead', 'on-track': 'On track', behind: 'Behind' }
  return (
    <span className={`flex-shrink-0 rounded-badge px-2 py-0.5 text-xs font-medium ${styles[pace]}`}>
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
      <div className="rounded-card border border-pine/30 bg-pine/5 p-4">
        <h3 className="text-sm font-semibold text-fjord">
          Suggested target for &ldquo;{goalLabel}&rdquo;
        </h3>
        <p className="mt-1 text-sm text-fjord">{proposal.description}</p>
        {proposal.monthlyNeeded != null && proposal.monthlyNeeded > 0 && (
          <p className="mt-1 text-xs text-stone">
            Monthly target: {formatCurrency(proposal.monthlyNeeded)}
          </p>
        )}
        <div className="mt-3 flex gap-3">
          <Button onClick={acceptTarget} size="sm">
            Set This Target
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setProposal(null)}>
            Dismiss
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-card border border-mist bg-frost/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="text-xs font-medium text-stone">{goalLabel}</span>
          <p className="mt-0.5 text-sm text-fjord">
            Set a target to see visible progress
          </p>
        </div>
        <Button onClick={proposeTarget} size="sm" disabled={proposing} loading={proposing} loadingText="Analyzing...">
          Suggest Target
        </Button>
      </div>
    </div>
  )
}
