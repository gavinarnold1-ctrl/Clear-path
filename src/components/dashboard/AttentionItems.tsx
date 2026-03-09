import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import type { RecalibrationSuggestion } from '@/lib/goal-recalibration'

interface OverBudgetItem {
  name: string
  overBy: number
  goalImpactWeeks?: number
}

interface BenefitAlert {
  benefitId: string
  userCardId: string
  message: string
  cardLabel: string
  severity: string
}

interface Props {
  overBudgetItems: OverBudgetItem[]
  recalibration: RecalibrationSuggestion | null
  benefitAlerts: BenefitAlert[]
  unbudgetedSpent?: number
  unidentifiedCards?: number
}

export default function AttentionItems({ overBudgetItems, recalibration, benefitAlerts, unbudgetedSpent = 0, unidentifiedCards = 0 }: Props) {
  const hasItems = overBudgetItems.length > 0 ||
    (recalibration && recalibration.type !== 'celebrate_completion') ||
    benefitAlerts.length > 0 ||
    unbudgetedSpent > 0 ||
    unidentifiedCards > 0

  if (!hasItems) return null

  return (
    <div className="mb-8">
      <h2 className="mb-3 text-base font-semibold text-fjord">Needs Attention</h2>
      <div className="space-y-2">
        {overBudgetItems.slice(0, 3).map((item) => (
          <Link
            key={item.name}
            href={`/budgets`}
            className="block rounded-card border border-ember/20 bg-ember/5 px-4 py-3 transition-colors hover:bg-ember/10"
          >
            <p className="text-sm text-fjord">
              <span className="font-medium">{item.name}</span> is{' '}
              <span className="font-semibold text-ember">{formatCurrency(item.overBy)}</span> over budget
              {item.goalImpactWeeks != null && item.goalImpactWeeks > 0 && (
                <span className="text-stone">
                  {' '}— pushing your goal out ~{item.goalImpactWeeks} week{item.goalImpactWeeks !== 1 ? 's' : ''}
                </span>
              )}
            </p>
          </Link>
        ))}

        {recalibration && recalibration.type !== 'celebrate_completion' && (
          <Link
            href="/settings"
            className="block rounded-card border border-birch/40 bg-birch/10 px-4 py-3 transition-colors hover:bg-birch/20"
          >
            <p className="text-sm text-fjord">
              Behind target pace for {recalibration.monthsBehind} month{recalibration.monthsBehind !== 1 ? 's' : ''}.
              <span className="ml-1 text-stone">Consider adjusting your timeline or contribution.</span>
            </p>
          </Link>
        )}

        {benefitAlerts.slice(0, 2).map((alert) => (
          <Link
            key={`${alert.benefitId}-${alert.userCardId}`}
            href="/accounts/benefits"
            className={`block rounded-card border px-4 py-3 transition-colors hover:bg-frost/60 ${
              alert.severity === 'urgent'
                ? 'border-ember/40 bg-ember/5'
                : 'border-birch/60 bg-birch/10'
            }`}
          >
            <p className="text-sm text-fjord">{alert.message}</p>
            <p className="mt-0.5 text-xs text-stone">{alert.cardLabel}</p>
          </Link>
        ))}

        {unbudgetedSpent > 0 && (
          <Link
            href="/transactions?unbudgeted=true"
            className="block rounded-card border border-birch/40 bg-birch/10 px-4 py-3 transition-colors hover:bg-birch/20"
          >
            <p className="text-sm text-fjord">
              <span className="font-semibold text-midnight">{formatCurrency(unbudgetedSpent)}</span>{' '}
              spent in categories without a budget
            </p>
            <p className="mt-0.5 text-xs text-stone">Create budgets to track this spending</p>
          </Link>
        )}

        {unidentifiedCards > 0 && (
          <Link
            href="/accounts/benefits"
            className="flex items-center justify-between rounded-card border border-birch/30 bg-birch/5 px-4 py-3 transition-colors hover:bg-birch/10"
          >
            <div>
              <p className="text-sm font-medium text-fjord">
                {unidentifiedCards} credit card{unidentifiedCards > 1 ? 's' : ''} not identified
              </p>
              <p className="mt-0.5 text-xs text-stone">
                Identify your cards to track rewards and get benefit reminders
              </p>
            </div>
            <span className="text-sm text-pine">Set up &rarr;</span>
          </Link>
        )}
      </div>
    </div>
  )
}
