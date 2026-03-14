import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { formatCurrency, formatDate, parseLocalDate } from '@/lib/utils'
import { piBreakdown } from '@/lib/engines/amortization'
import { getForecastSummaries } from '@/lib/forecast-helpers'
import { computeDebtPayoffAcceleration } from '@/lib/engines/forecast'
import type { IncomeTransition, DebtForForecast } from '@/types'
import DebtManager from '@/components/debts/DebtManager'
import { DebtAccelerationTracker } from '@/components/debts/DebtAccelerationTracker'

export const metadata: Metadata = { title: 'Debts' }

export default async function DebtsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const [debts, properties, categories] = await Promise.all([
    db.debt.findMany({
      where: { userId: session.userId },
      include: {
        property: { include: { group: { select: { id: true, name: true } } } },
        category: true,
      },
      orderBy: { currentBalance: 'desc' },
    }),
    db.property.findMany({
      where: { userId: session.userId },
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, type: true, taxSchedule: true,
        currentValue: true, loanBalance: true, monthlyPayment: true,
        interestRate: true, loanTermMonths: true,
        monthlyPropertyTax: true, monthlyInsurance: true, monthlyHOA: true, monthlyPMI: true,
      },
    }),
    db.category.findMany({
      where: {
        OR: [{ userId: session.userId }, { userId: null, isDefault: true }],
        isActive: true,
        type: 'expense',
      },
      orderBy: [{ group: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, group: true },
    }),
  ])

  const forecastSummary = await getForecastSummaries(session.userId)

  // Payoff acceleration data
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const [profile, expenseAgg, incomeAgg] = await Promise.all([
    db.userProfile.findUnique({
      where: { userId: session.userId },
      select: { expectedMonthlyIncome: true, incomeTransitions: true },
    }),
    db.transaction.aggregate({
      where: { userId: session.userId, date: { gte: monthStart, lt: monthEnd }, amount: { lt: 0 } },
      _sum: { amount: true },
    }),
    db.transaction.aggregate({
      where: { userId: session.userId, date: { gte: monthStart, lt: monthEnd }, amount: { gt: 0 } },
      _sum: { amount: true },
    }),
  ])

  const incomeTransitions = (profile?.incomeTransitions as IncomeTransition[] | null) ?? []

  const accelerationResults = (() => {
    if (debts.length === 0 || incomeTransitions.length === 0) return []
    const currentMonthlyExpenses = Math.abs(expenseAgg._sum.amount ?? 0)
    const currentMonthlyIncome = profile?.expectedMonthlyIncome ?? (incomeAgg._sum.amount ?? 0)
    const debtInputs: DebtForForecast[] = debts.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      balance: d.currentBalance,
      interestRate: d.interestRate,
      minimumPayment: d.minimumPayment,
      escrowAmount: d.escrowAmount ?? 0,
      propertyGroupId: d.property?.groupId ?? null,
    }))
    return computeDebtPayoffAcceleration(debtInputs, currentMonthlyExpenses, currentMonthlyIncome, incomeTransitions)
  })()

  // Compute summary
  const totalDebt = debts.reduce((sum, d) => sum + d.currentBalance, 0)
  const totalPayments = debts.reduce((sum, d) => sum + d.minimumPayment, 0)
  const weightedRate =
    totalDebt > 0
      ? debts.reduce((sum, d) => sum + d.currentBalance * d.interestRate, 0) / totalDebt
      : 0

  // CC vs installment breakdown
  const ccDebts = debts.filter(d => d.type === 'CREDIT_CARD')
  const installmentDebts = debts.filter(d => d.type !== 'CREDIT_CARD')
  const ccTotal = ccDebts.reduce((s, d) => s + d.currentBalance, 0)
  const installmentTotal = installmentDebts.reduce((s, d) => s + d.currentBalance, 0)
  const ccPaidInFull = ccDebts.filter(d => d.ccBehavior === 'pays_in_full').length

  // Serialize for client component
  const serializedDebts = debts.map((d) => {
    const pi = piBreakdown(d.currentBalance, d.interestRate, d.minimumPayment, d.escrowAmount)

    return {
      id: d.id,
      name: d.name,
      type: d.type,
      currentBalance: d.currentBalance,
      originalBalance: d.originalBalance,
      interestRate: d.interestRate,
      minimumPayment: d.minimumPayment,
      escrowAmount: d.escrowAmount ?? null,
      paymentDay: d.paymentDay,
      termMonths: d.termMonths,
      startDate: d.startDate?.toISOString() ?? null,
      propertyId: d.propertyId,
      categoryId: d.categoryId,
      property: d.property ? {
        id: d.property.id,
        name: d.property.name,
        taxSchedule: d.property.taxSchedule,
        groupId: d.property.groupId ?? null,
        groupName: d.property.group?.name ?? null,
        splitPct: d.property.splitPct ? Number(d.property.splitPct) : null,
      } : null,
      category: d.category ? { id: d.category.id, name: d.category.name } : null,
      monthlyInterest: pi.monthlyInterest,
      monthlyPrincipal: pi.monthlyPrincipal,
      monthsRemaining: pi.monthsRemaining,
      ccBehavior: d.ccBehavior ?? null,
      observedInterestRate: d.observedInterestRate ?? null,
      avgMonthlySpend: d.avgMonthlySpend ?? null,
      monthsCarried: d.monthsCarried ?? null,
    }
  })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-fjord">Debts</h1>
      </div>

      {/* Forecast context */}
      {forecastSummary && (
        <div className="mb-4 rounded-lg border border-pine/20 bg-pine/5 px-4 py-3">
          <span className="text-xs font-medium text-stone">Debt · Goal connection</span>
          <p className="text-sm text-fjord">{forecastSummary.debts}</p>
        </div>
      )}

      {/* Summary card */}
      {debts.length > 0 && (
        <div className="card mb-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium text-stone">Total debt</p>
              <p className="mt-1 font-mono text-2xl font-bold text-fjord">{formatCurrency(totalDebt)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-stone">Monthly payments</p>
              <p className="mt-1 font-mono text-2xl font-bold text-fjord">{formatCurrency(totalPayments)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-stone">Avg interest rate</p>
              <p className="mt-1 font-mono text-2xl font-bold text-fjord">{(weightedRate * 100).toFixed(2)}%</p>
            </div>
          </div>
          {(ccDebts.length > 0 && installmentDebts.length > 0) && (
            <p className="mt-3 border-t border-mist pt-3 text-xs text-stone">
              {installmentDebts.length} installment {installmentDebts.length === 1 ? 'debt' : 'debts'} ({formatCurrency(installmentTotal)})
              {' · '}
              {ccDebts.length} credit {ccDebts.length === 1 ? 'card' : 'cards'} ({formatCurrency(ccTotal)} balance{ccPaidInFull > 0 ? `, ${ccPaidInFull} paid in full` : ''})
            </p>
          )}
        </div>
      )}

      <DebtManager debts={serializedDebts} properties={properties} categories={categories} />

      {/* Payoff Acceleration */}
      {accelerationResults.length > 0 && (
        <div className="mt-6">
          <DebtAccelerationTracker
            debtCount={accelerationResults.length}
            monthsSaved={accelerationResults.reduce((s, a) => s + a.monthsSaved, 0)}
            interestSaved={accelerationResults.reduce((s, a) => s + a.interestSaved, 0)}
          />
          <h2 className="font-display text-lg font-bold text-fjord mb-3">Payoff Acceleration</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {accelerationResults.map((a) => (
              <div key={a.debtId} className="card">
                <p className="font-display text-sm font-semibold text-fjord">{a.debtName}</p>
                <p className="mt-1 font-mono text-xs text-stone">
                  Balance: {formatCurrency(a.balance)}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <p className="text-stone">Baseline payoff</p>
                    <p className="font-mono text-ember">
                      {a.baselinePayoffDate ? formatDate(parseLocalDate(a.baselinePayoffDate)) : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-stone">Accelerated payoff</p>
                    <p className="font-mono text-fjord">
                      {a.acceleratedPayoffDate ? formatDate(parseLocalDate(a.acceleratedPayoffDate)) : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-stone">Months saved</p>
                    <p className={`font-mono ${a.monthsSaved > 0 ? 'text-pine' : 'text-fjord'}`}>
                      {a.monthsSaved}
                    </p>
                  </div>
                  <div>
                    <p className="text-stone">Interest saved</p>
                    <p className={`font-mono ${a.interestSaved > 0 ? 'text-pine' : 'text-fjord'}`}>
                      {formatCurrency(a.interestSaved)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cross-links */}
      {debts.length > 0 && (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href="/forecast?focus=debt"
            className="rounded-button border border-mist bg-frost/50 px-4 py-3 text-center text-sm font-medium text-fjord transition-colors hover:bg-frost hover:text-pine"
          >
            See payoff timeline &rarr;
          </Link>
          <div className="rounded-button border border-mist bg-frost/50 px-4 py-3 text-sm text-stone">
            Review your{' '}
            <Link href="/budgets" className="font-medium text-pine underline">
              flexible budgets
            </Link>{' '}
            for categories you could reduce to free up money for extra debt payments.
          </div>
        </div>
      )}
    </div>
  )
}
