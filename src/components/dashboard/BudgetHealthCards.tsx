import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import type { PrimaryGoal } from '@/types'

interface Props {
  fixedPaid: number
  fixedTotal: number
  flexibleSpent: number
  flexibleBudget: number
  flexibleUnderBudget: number
  primaryGoal: PrimaryGoal | null
  annualFundProgress?: number
  annualFundTotal?: number
  totalDebt?: number
  debtPayments?: number
  benchmarkScore?: number
  categorizationPct?: number
  netWorth?: number
}

export default function BudgetHealthCards({
  fixedPaid,
  fixedTotal,
  flexibleSpent,
  flexibleBudget,
  flexibleUnderBudget,
  primaryGoal,
  annualFundProgress,
  annualFundTotal,
  totalDebt,
  debtPayments,
  benchmarkScore,
  categorizationPct,
  netWorth,
}: Props) {
  const showNetWorthSeparately = primaryGoal !== 'build_wealth' && netWorth != null

  return (
    <div className={`mb-8 grid grid-cols-1 gap-4 ${showNetWorthSeparately ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'}`}>
      {/* Card 1: Fixed Bills */}
      <Link href="/budgets" className="card transition-colors hover:border-fjord/30">
        <p className="text-xs font-medium uppercase tracking-wider text-stone">Fixed Bills</p>
        <p className="mt-1 text-2xl font-bold text-fjord">
          {fixedPaid} of {fixedTotal}
        </p>
        <p className="mt-1 text-xs text-stone">paid this month</p>
      </Link>

      {/* Card 2: Flexible Spending */}
      <Link href="/budgets" className="card transition-colors hover:border-fjord/30">
        <p className="text-xs font-medium uppercase tracking-wider text-stone">Flexible Spending</p>
        <p className="mt-1 text-2xl font-bold text-fjord">
          {formatCurrency(flexibleSpent)}
          <span className="text-sm font-normal text-stone"> / {formatCurrency(flexibleBudget)}</span>
        </p>
        {flexibleUnderBudget > 0 && primaryGoal && (
          <p className="mt-1 text-xs text-pine">
            {formatCurrency(flexibleUnderBudget)} under budget
          </p>
        )}
      </Link>

      {/* Card 3: Archetype-specific */}
      <ArchetypeCard
        primaryGoal={primaryGoal}
        annualFundProgress={annualFundProgress}
        annualFundTotal={annualFundTotal}
        totalDebt={totalDebt}
        debtPayments={debtPayments}
        benchmarkScore={benchmarkScore}
        categorizationPct={categorizationPct}
        netWorth={netWorth}
      />

      {/* Card 4: Net Worth (always visible unless build_wealth archetype already shows it) */}
      {showNetWorthSeparately && (
        <Link href="/accounts" className="card transition-colors hover:border-fjord/30">
          <p className="text-xs font-medium uppercase tracking-wider text-stone">Net Worth</p>
          <p className="mt-1 font-mono text-2xl font-bold text-fjord">{formatCurrency(netWorth)}</p>
          <p className="mt-1 text-xs text-stone">total assets minus liabilities</p>
        </Link>
      )}
    </div>
  )
}

function ArchetypeCard({
  primaryGoal,
  annualFundProgress,
  annualFundTotal,
  totalDebt,
  debtPayments,
  benchmarkScore,
  categorizationPct,
  netWorth,
}: Omit<Props, 'fixedPaid' | 'fixedTotal' | 'flexibleSpent' | 'flexibleBudget' | 'flexibleUnderBudget'>) {
  switch (primaryGoal) {
    case 'save_more':
      return (
        <Link href="/budgets/annual" className="card transition-colors hover:border-fjord/30">
          <p className="text-xs font-medium uppercase tracking-wider text-stone">Annual Fund</p>
          <p className="mt-1 text-2xl font-bold text-fjord">
            {formatCurrency(annualFundProgress ?? 0)}
            <span className="text-sm font-normal text-stone"> / {formatCurrency(annualFundTotal ?? 0)}</span>
          </p>
          <p className="mt-1 text-xs text-stone">funded toward annual expenses</p>
        </Link>
      )

    case 'pay_off_debt':
      return (
        <Link href="/debts" className="card transition-colors hover:border-fjord/30">
          <p className="text-xs font-medium uppercase tracking-wider text-stone">Debt Progress</p>
          <p className="mt-1 text-2xl font-bold text-fjord">{formatCurrency(totalDebt ?? 0)}</p>
          <p className="mt-1 text-xs text-stone">
            {formatCurrency(debtPayments ?? 0)}/mo payments
          </p>
        </Link>
      )

    case 'spend_smarter':
      return (
        <Link href="/spending" className="card transition-colors hover:border-fjord/30">
          <p className="text-xs font-medium uppercase tracking-wider text-stone">Benchmark Score</p>
          <p className="mt-1 text-2xl font-bold text-fjord">
            {benchmarkScore != null ? `${benchmarkScore}%` : '—'}
          </p>
          <p className="mt-1 text-xs text-stone">categories at or below benchmark</p>
        </Link>
      )

    case 'gain_visibility':
      return (
        <Link href="/transactions" className="card transition-colors hover:border-fjord/30">
          <p className="text-xs font-medium uppercase tracking-wider text-stone">Categorization</p>
          <p className="mt-1 text-2xl font-bold text-fjord">
            {categorizationPct != null ? `${categorizationPct}%` : '—'}
          </p>
          <p className="mt-1 text-xs text-stone">transactions categorized</p>
        </Link>
      )

    case 'build_wealth':
      return (
        <Link href="/accounts" className="card transition-colors hover:border-fjord/30">
          <p className="text-xs font-medium uppercase tracking-wider text-stone">Net Worth</p>
          <p className="mt-1 text-2xl font-bold text-fjord">{formatCurrency(netWorth ?? 0)}</p>
          <p className="mt-1 text-xs text-stone">total assets minus liabilities</p>
        </Link>
      )

    default:
      return (
        <Link href="/monthly-review" className="card transition-colors hover:border-fjord/30">
          <p className="text-xs font-medium uppercase tracking-wider text-stone">Monthly Review</p>
          <p className="mt-2 text-sm text-stone">Check your financial health</p>
        </Link>
      )
  }
}
