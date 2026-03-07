import Link from 'next/link'
import type { PrimaryGoal } from '@/types'

interface Props {
  primaryGoal: PrimaryGoal | null
  showMonthlyReviewCTA?: boolean
}

const GOAL_LINKS: Record<PrimaryGoal, { href: string; label: string }> = {
  pay_off_debt: { href: '/debts', label: 'View debt payoff plan →' },
  build_wealth: { href: '/accounts', label: 'View net worth →' },
  spend_smarter: { href: '/spending', label: 'View spending benchmarks →' },
  gain_visibility: { href: '/transactions?uncategorized=true', label: 'Categorize transactions →' },
  save_more: { href: '/forecast', label: 'View savings forecast →' },
}

export default function GoalCrossLinks({ primaryGoal, showMonthlyReviewCTA }: Props) {
  const goalLink = primaryGoal ? GOAL_LINKS[primaryGoal] : null

  if (!goalLink && !showMonthlyReviewCTA) return null

  return (
    <div className="mb-8 flex flex-wrap gap-3">
      {goalLink && (
        <Link
          href={goalLink.href}
          className="rounded-button border border-mist bg-frost/50 px-4 py-2 text-sm font-medium text-fjord transition-colors hover:bg-frost hover:text-pine"
        >
          {goalLink.label}
        </Link>
      )}
      {showMonthlyReviewCTA && (
        <Link
          href="/monthly-review"
          className="rounded-button border border-mist bg-frost/50 px-4 py-2 text-sm font-medium text-fjord transition-colors hover:bg-frost hover:text-pine"
        >
          Review last month →
        </Link>
      )}
    </div>
  )
}
