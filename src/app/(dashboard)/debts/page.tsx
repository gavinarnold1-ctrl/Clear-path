import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'
import { piBreakdown } from '@/lib/engines/amortization'
import DebtManager from '@/components/debts/DebtManager'

export const metadata: Metadata = { title: 'Debts' }

export default async function DebtsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const [debts, properties, categories] = await Promise.all([
    db.debt.findMany({
      where: { userId: session.userId },
      include: { property: true, category: true },
      orderBy: { currentBalance: 'desc' },
    }),
    db.property.findMany({
      where: { userId: session.userId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, type: true },
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

  // Compute summary
  const totalDebt = debts.reduce((sum, d) => sum + d.currentBalance, 0)
  const totalPayments = debts.reduce((sum, d) => sum + d.minimumPayment, 0)
  const weightedRate =
    totalDebt > 0
      ? debts.reduce((sum, d) => sum + d.currentBalance * d.interestRate, 0) / totalDebt
      : 0

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
      property: d.property ? { id: d.property.id, name: d.property.name } : null,
      category: d.category ? { id: d.category.id, name: d.category.name } : null,
      monthlyInterest: pi.monthlyInterest,
      monthlyPrincipal: pi.monthlyPrincipal,
      monthsRemaining: pi.monthsRemaining,
    }
  })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-fjord">Debts</h1>
      </div>

      {/* Summary card */}
      {debts.length > 0 && (
        <div className="card mb-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-stone">Total Debt</p>
              <p className="mt-1 text-2xl font-bold text-fjord">{formatCurrency(totalDebt)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-stone">Monthly Payments</p>
              <p className="mt-1 text-2xl font-bold text-fjord">{formatCurrency(totalPayments)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-stone">Avg Interest Rate</p>
              <p className="mt-1 text-2xl font-bold text-fjord">{(weightedRate * 100).toFixed(2)}%</p>
            </div>
          </div>
        </div>
      )}

      <DebtManager debts={serializedDebts} properties={properties} categories={categories} />
    </div>
  )
}
