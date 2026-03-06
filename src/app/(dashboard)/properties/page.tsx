import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import MonthPicker from '../dashboard/MonthPicker'
import PropertiesClient from './PropertiesClient'
import Link from 'next/link'
import { calculateDepreciation } from '@/lib/engines/tax'
import { generateTaxSummary } from '@/lib/engines/tax'
import AddPropertyInline from '@/components/properties/AddPropertyInline'
import AddPropertyButton from '@/components/properties/AddPropertyButton'

interface AccountOption {
  id: string
  name: string
  type: string
  balance: number
}

export const metadata: Metadata = { title: 'Properties & Businesses — oversikt' }

interface Props {
  searchParams: Promise<{ month?: string; tab?: string }>
}

export default async function PropertiesPage({ searchParams }: Props) {
  const session = await getSession()
  if (!session) redirect('/login')

  const params = await searchParams

  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth()
  if (params.month) {
    const [y, m] = params.month.split('-').map(Number)
    if (y && m && m >= 1 && m <= 12) {
      year = y
      month = m - 1
    }
  }

  const startDate = new Date(year, month, 1)
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999)
  const monthLabel = startDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })
  const monthParam = `${year}-${String(month + 1).padStart(2, '0')}`

  // Fetch properties and accounts
  const [properties, userAccounts] = await Promise.all([
    db.property.findMany({
      where: { userId: session.userId },
      orderBy: { name: 'asc' },
    }),
    db.account.findMany({
      where: { userId: session.userId },
      select: { id: true, name: true, type: true, balance: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const accountsForWizard: AccountOption[] = userAccounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    balance: a.balance,
  }))

  if (properties.length === 0) {
    return (
      <div>
        <h1 className="mb-6 font-display text-2xl font-semibold text-fjord">
          Properties & Businesses
        </h1>
        <AddPropertyInline accounts={accountsForWizard} />
      </div>
    )
  }

  // Fetch transactions with propertyId for this month
  const directTransactions = await db.transaction.findMany({
    where: {
      userId: session.userId,
      date: { gte: startDate, lte: endDate },
      propertyId: { not: null },
    },
    include: {
      category: { select: { group: true, name: true, scheduleECategory: true } },
    },
  })

  // Fetch transaction splits for this month
  const splits = await db.transactionSplit.findMany({
    where: {
      transaction: {
        userId: session.userId,
        date: { gte: startDate, lte: endDate },
      },
    },
    include: {
      transaction: {
        include: {
          category: { select: { group: true, name: true, scheduleECategory: true } },
        },
      },
    },
  })

  // Build a set of transaction IDs that have splits, to avoid double-counting
  const txIdsWithSplits = new Set(splits.map((s) => s.transaction.id))

  // Build per-property data
  const propertyData = properties.map((prop) => {
    // Direct attributions for this property — exclude transactions that have splits
    // (their amounts are captured via split records instead to avoid double-counting)
    const directTxs = directTransactions.filter(
      (t) => t.propertyId === prop.id && !txIdsWithSplits.has(t.id),
    )
    // Split allocations for this property
    const propSplits = splits.filter((s) => s.propertyId === prop.id)

    let income = 0
    let expenses = 0

    // From direct transactions (only those without splits)
    for (const tx of directTxs) {
      if (tx.classification === 'income' || tx.amount > 0) {
        income += Math.abs(tx.amount)
      } else if (tx.classification === 'expense') {
        expenses += Math.abs(tx.amount)
      }
    }

    // From splits (the allocated portion for this property)
    for (const s of propSplits) {
      if (s.transaction.classification === 'income' || s.amount > 0) {
        income += Math.abs(s.amount)
      } else if (s.transaction.classification === 'expense') {
        expenses += Math.abs(s.amount)
      }
    }

    // Depreciation (for rentals with purchase data)
    let depreciation = 0
    if (prop.type === 'RENTAL' && prop.purchasePrice && prop.purchaseDate) {
      const depResult = calculateDepreciation({
        purchasePrice: Number(prop.purchasePrice),
        purchaseDate: prop.purchaseDate,
        buildingValuePct: Number(prop.buildingValuePct ?? 80),
        priorDepreciation: Number(prop.priorDepreciation ?? 0),
        asOfDate: endDate,
      })
      // Monthly depreciation for this month
      depreciation = depResult.monthlyDepreciation
    }

    const transactionCount = directTxs.length + propSplits.length
    const net = Math.round((income - expenses - depreciation) * 100) / 100

    return {
      id: prop.id,
      name: prop.name,
      type: prop.type as string,
      address: [prop.address, prop.city, prop.state, prop.zipCode].filter(Boolean).join(', '),
      taxSchedule: prop.taxSchedule ?? (
        prop.type === 'RENTAL' ? 'SCHEDULE_E' :
          prop.type === 'BUSINESS' ? 'SCHEDULE_C' :
            'SCHEDULE_A'
      ),
      income: Math.round(income * 100) / 100,
      expenses: Math.round(expenses * 100) / 100,
      depreciation: Math.round(depreciation * 100) / 100,
      net,
      transactionCount,
      // Financial details for PropertyFinancialForm
      currentValue: prop.currentValue,
      loanBalance: prop.loanBalance,
      monthlyPayment: prop.monthlyPayment,
      interestRate: prop.interestRate,
      loanTermMonths: prop.loanTermMonths,
      loanStartDate: prop.loanStartDate?.toISOString() ?? null,
      monthlyPropertyTax: prop.monthlyPropertyTax,
      monthlyInsurance: prop.monthlyInsurance,
      monthlyHOA: prop.monthlyHOA,
      monthlyPMI: prop.monthlyPMI,
    }
  })

  // Filter: PERSONAL only shown if it has transactions
  const visibleProperties = propertyData.filter(
    (p) => p.type !== 'PERSONAL' || p.transactionCount > 0,
  )

  // Totals
  const totalRentalNet = visibleProperties
    .filter((p) => p.taxSchedule === 'SCHEDULE_E')
    .reduce((s, p) => s + p.net, 0)
  const totalBusinessNet = visibleProperties
    .filter((p) => p.taxSchedule === 'SCHEDULE_C')
    .reduce((s, p) => s + p.net, 0)
  const totalDepreciation = visibleProperties.reduce((s, p) => s + p.depreciation, 0)

  // Tax summary for tax report tab
  const taxSummaryData = generateTaxSummary(
    splits.map((s) => ({
      propertyId: s.propertyId,
      amount: s.amount,
      transaction: {
        classification: s.transaction.classification,
        category: s.transaction.category
          ? {
            group: s.transaction.category.group,
            name: s.transaction.category.name,
            scheduleECategory: s.transaction.category.scheduleECategory,
          }
          : undefined,
      },
    })),
    directTransactions
      .filter((t) => !txIdsWithSplits.has(t.id))
      .map((t) => ({
        propertyId: t.propertyId!,
        amount: t.amount,
        classification: t.classification,
        category: t.category
          ? {
            group: t.category.group,
            name: t.category.name,
            scheduleECategory: t.category.scheduleECategory,
          }
          : undefined,
      })),
    properties.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      taxSchedule: p.taxSchedule,
      purchasePrice: p.purchasePrice ? Number(p.purchasePrice) : null,
      purchaseDate: p.purchaseDate,
      buildingValuePct: p.buildingValuePct ? Number(p.buildingValuePct) : null,
      priorDepreciation: p.priorDepreciation ? Number(p.priorDepreciation) : null,
      // Financial details for PITI decomposition
      loanBalance: p.loanBalance,
      interestRate: p.interestRate,
      monthlyPayment: p.monthlyPayment,
      monthlyPropertyTax: p.monthlyPropertyTax,
      monthlyInsurance: p.monthlyInsurance,
      monthlyHOA: p.monthlyHOA,
      monthlyPMI: p.monthlyPMI,
    })),
    { start: startDate, end: endDate },
  )

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-semibold text-fjord">
          Properties & Businesses
        </h1>
        <div className="flex items-center gap-3">
          <AddPropertyButton accounts={accountsForWizard} />
          <MonthPicker currentMonth={monthParam} />
          <Link href="/settings" className="text-sm text-stone hover:text-fjord">
            Manage in Settings
          </Link>
        </div>
      </div>

      <PropertiesClient
        properties={visibleProperties}
        totalRentalNet={Math.round(totalRentalNet * 100) / 100}
        totalBusinessNet={Math.round(totalBusinessNet * 100) / 100}
        totalDepreciation={Math.round(totalDepreciation * 100) / 100}
        taxSummary={taxSummaryData}
        monthParam={monthParam}
        monthLabel={monthLabel}
        initialTab={params.tab ?? 'dashboard'}
        accounts={accountsForWizard}
      />
    </div>
  )
}
