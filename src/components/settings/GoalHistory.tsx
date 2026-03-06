import type { PrimaryGoal } from '@/types'

interface GoalHistoryEntry {
  goal: string
  setAt: string
  changedAt: string
}

const GOAL_LABELS: Record<PrimaryGoal, string> = {
  save_more: 'Save More',
  spend_smarter: 'Spend Smarter',
  pay_off_debt: 'Pay Off Debt',
  gain_visibility: 'Gain Visibility',
  build_wealth: 'Build Wealth',
}

interface Props {
  currentGoal: PrimaryGoal
  goalSetAt: string | null
  previousGoals: GoalHistoryEntry[]
}

export default function GoalHistory({ currentGoal, goalSetAt, previousGoals }: Props) {
  if (previousGoals.length === 0) return null

  return (
    <div className="mt-4">
      <h4 className="text-sm font-medium text-stone">Goal History</h4>
      <div className="mt-2 space-y-2">
        {/* Current goal */}
        <div className="flex items-center gap-3 text-sm">
          <span className="h-2 w-2 shrink-0 rounded-full bg-pine" />
          <span className="font-medium text-fjord">{GOAL_LABELS[currentGoal] ?? currentGoal}</span>
          <span className="text-stone">
            since {goalSetAt ? new Date(goalSetAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'setup'}
          </span>
          <span className="rounded-full bg-pine/10 px-2 py-0.5 text-xs font-medium text-pine">Current</span>
        </div>

        {/* Previous goals (reverse chronological) */}
        {[...previousGoals].reverse().map((entry, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            <span className="h-2 w-2 shrink-0 rounded-full bg-mist" />
            <span className="text-stone">{GOAL_LABELS[entry.goal as PrimaryGoal] ?? entry.goal}</span>
            <span className="text-stone/60">
              {new Date(entry.setAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              {' \u2192 '}
              {new Date(entry.changedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
