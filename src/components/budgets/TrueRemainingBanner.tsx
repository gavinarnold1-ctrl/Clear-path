import { formatCurrency } from '@/lib/utils'
import type { PrimaryGoal } from '@/types'

interface TrueRemainingProps {
  income: number
  expectedIncome: number | null
  fixedTotal: number
  flexibleSpent: number
  flexibleBudget: number
  annualSetAside: number
  unbudgetedSpent?: number
  primaryGoal?: PrimaryGoal | null
}

export default function TrueRemainingBanner({
  income,
  expectedIncome,
  fixedTotal,
  flexibleSpent,
  annualSetAside,
  unbudgetedSpent = 0,
  primaryGoal,
}: TrueRemainingProps) {
  const displayIncome = expectedIncome ?? income
  const totalFlexSpent = flexibleSpent + unbudgetedSpent
  const trueRemaining = displayIncome - fixedTotal - totalFlexSpent - annualSetAside
  const incomeRatio = displayIncome > 0 ? trueRemaining / displayIncome : 0

  // Color coding based on remaining percentage of income
  const borderColor =
    incomeRatio > 0.2
      ? 'border-pine/30'
      : incomeRatio > 0.05
        ? 'border-birch/30'
        : 'border-ember/30'

  const amountColorClass =
    incomeRatio > 0.2
      ? 'text-pine'
      : incomeRatio > 0.05
        ? 'text-birch'
        : 'text-ember'

  // Contextual subtitle based on goal
  const subtitle = getSubtitle(primaryGoal ?? null, trueRemaining)

  // Income line: show "of $X expected" if expected differs from received
  const hasExpected = expectedIncome != null && expectedIncome > 0
  const incomeBelow = hasExpected && income < expectedIncome!

  return (
    <div className={`rounded-card border-2 ${borderColor} bg-snow p-5`}>
      {/* Hero number */}
      <p className="text-xs font-medium text-stone">True remaining</p>
      <p className={`font-display text-4xl font-bold tracking-tight ${amountColorClass}`}>
        {formatCurrency(trueRemaining)}
      </p>
      <p className="mt-1 text-sm text-stone">{subtitle}</p>

      {/* Visible equation */}
      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-stone">
        <span className="font-medium text-fjord">
          {formatCurrency(income)}
          {incomeBelow && (
            <span className="font-normal text-stone"> of {formatCurrency(expectedIncome!)} expected</span>
          )}
        </span>
        <span>&minus;</span>
        <span>{formatCurrency(fixedTotal)} fixed</span>
        <span>&minus;</span>
        <span>{formatCurrency(totalFlexSpent)} flexible</span>
        {annualSetAside > 0 && (
          <>
            <span>&minus;</span>
            <span>{formatCurrency(annualSetAside)} annual</span>
          </>
        )}
      </div>
    </div>
  )
}

function getSubtitle(goal: PrimaryGoal | null, remaining: number): string {
  if (remaining <= 0) return 'All committed — review flexible spending for room'

  switch (goal) {
    case 'save_more':
      return 'Available to save this month'
    case 'pay_off_debt':
      return 'Available for extra debt payments'
    case 'spend_smarter':
      return 'Your spending freedom after all commitments'
    case 'gain_visibility':
      return 'What you can actually spend'
    case 'build_wealth':
      return 'Available for wealth-building moves'
    default:
      return 'What you can actually spend'
  }
}
