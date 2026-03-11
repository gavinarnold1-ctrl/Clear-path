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
  hasStaleBalances?: boolean
  staleAccountCount?: number
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
  hasStaleBalances,
  staleAccountCount,
}: Props) {
  const showNetWorthSeparately = primaryGoal !== 'build_wealth' && netWorth != null

  const fixedPct = fixedTotal > 0 ? Math.round((fixedPaid / fixedTotal) * 100) : 0
  const flexPct = flexibleBudget > 0 ? Math.min(100, Math.round((flexibleSpent / flexibleBudget) * 100)) : 0
  const flexOver = flexibleSpent > flexibleBudget

  return (
    <div className={`mb-8 grid grid-cols-1 gap-4 ${showNetWorthSeparately ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'}`}>
      {/* Card 1: Fixed bills */}
      <Link href="/budgets" className="card transition-colors hover:border-fjord/30">
        <p className="text-xs font-medium text-stone">Fixed bills</p>
        <p className="mt-1 text-2xl font-bold text-fjord">
          {fixedPaid} of {fixedTotal}
        </p>
        <MicroBar pct={fixedPct} color="bg-pine" />
        <p className="mt-1 text-xs text-stone">paid this month</p>
      </Link>

      {/* Card 2: Flexible spending — shows spent, not budgeted */}
      <Link href="/budgets" className="card transition-colors hover:border-fjord/30">
        <p className="text-xs font-medium text-stone">Flexible spending</p>
        <p className={`mt-1 text-2xl font-bold ${flexOver ? 'text-ember' : 'text-fjord'}`}>
          {formatCurrency(flexibleSpent)}
          <span className="text-sm font-normal text-stone"> / {formatCurrency(flexibleBudget)}</span>
        </p>
        <MicroBar pct={flexPct} color={flexOver ? 'bg-ember' : 'bg-pine'} />
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

      {/* Card 4: Net worth (always visible unless build_wealth archetype already shows it) */}
      {showNetWorthSeparately && (
        <Link href="/accounts" className="card transition-colors hover:border-fjord/30">
          <p className="text-xs font-medium text-stone">Net worth</p>
          <p className="mt-1 text-2xl font-bold text-fjord">{formatCurrency(netWorth)}</p>
          {hasStaleBalances ? (
            <p className="mt-1 text-xs text-ember/80">
              {staleAccountCount} account{(staleAccountCount ?? 0) !== 1 ? 's' : ''} may be outdated
            </p>
          ) : (
            <p className="mt-1 text-xs text-stone">total assets minus liabilities</p>
          )}
        </Link>
      )}
    </div>
  )
}

function MicroBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="mt-2 h-[3px] w-full overflow-hidden rounded-bar bg-mist">
      <div
        className={`h-full rounded-bar ${color} transition-all duration-500`}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
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
    case 'save_more': {
      const pct = annualFundTotal && annualFundTotal > 0 ? Math.round(((annualFundProgress ?? 0) / annualFundTotal) * 100) : 0
      return (
        <Link href="/budgets/annual" className="card transition-colors hover:border-fjord/30">
          <p className="text-xs font-medium text-stone">Annual fund</p>
          <p className="mt-1 text-2xl font-bold text-fjord">
            {formatCurrency(annualFundProgress ?? 0)}
            <span className="text-sm font-normal text-stone"> / {formatCurrency(annualFundTotal ?? 0)}</span>
          </p>
          <MicroBar pct={pct} color="bg-pine" />
          <p className="mt-1 text-xs text-stone">funded toward annual expenses</p>
        </Link>
      )
    }

    case 'pay_off_debt':
      return (
        <Link href="/debts" className="card transition-colors hover:border-fjord/30">
          <p className="text-xs font-medium text-stone">Debt progress</p>
          <p className="mt-1 text-2xl font-bold text-fjord">{formatCurrency(totalDebt ?? 0)}</p>
          <p className="mt-1 text-xs text-stone">
            {formatCurrency(debtPayments ?? 0)}/mo payments
          </p>
        </Link>
      )

    case 'spend_smarter':
      return (
        <Link href="/spending" className="card transition-colors hover:border-fjord/30">
          <p className="text-xs font-medium text-stone">Benchmark score</p>
          <p className="mt-1 text-2xl font-bold text-fjord">
            {benchmarkScore != null ? `${benchmarkScore}%` : '—'}
          </p>
          {benchmarkScore != null && <MicroBar pct={benchmarkScore} color="bg-pine" />}
          <p className="mt-1 text-xs text-stone">categories at or below benchmark</p>
        </Link>
      )

    case 'gain_visibility': {
      return (
        <Link href="/transactions" className="card transition-colors hover:border-fjord/30">
          <p className="text-xs font-medium text-stone">Categorization</p>
          <p className="mt-1 text-2xl font-bold text-fjord">
            {categorizationPct != null ? `${categorizationPct}%` : '—'}
          </p>
          {categorizationPct != null && <MicroBar pct={categorizationPct} color="bg-pine" />}
          <p className="mt-1 text-xs text-stone">transactions categorized</p>
        </Link>
      )
    }

    case 'build_wealth':
      return (
        <Link href="/accounts" className="card transition-colors hover:border-fjord/30">
          <p className="text-xs font-medium text-stone">Net worth</p>
          <p className="mt-1 text-2xl font-bold text-fjord">{formatCurrency(netWorth ?? 0)}</p>
          <p className="mt-1 text-xs text-stone">total assets minus liabilities</p>
        </Link>
      )

    default:
      return (
        <Link href="/monthly-review" className="card transition-colors hover:border-fjord/30">
          <p className="text-xs font-medium text-stone">Monthly review</p>
          <p className="mt-2 text-sm text-stone">Check your financial health</p>
        </Link>
      )
  }
}
