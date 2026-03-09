import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import TransactionList from '@/components/transactions/TransactionList'
import DuplicateReview from '@/components/transactions/DuplicateReview'
import { findRefundPairs } from '@/lib/refund-detection'
import { getForecastSummaries } from '@/lib/forecast-helpers'
import { claimTransactions, CATCHALL_NAMES } from '@/lib/budget-claiming'

export const metadata: Metadata = { title: 'Transactions' }

interface PageProps {
  searchParams: Promise<{ categoryId?: string; month?: string; personId?: string; propertyId?: string; accountId?: string; search?: string; classification?: string; annualExpenseId?: string; annualExpenseName?: string; uncategorized?: string; unbudgeted?: string; budgetId?: string; tier?: string; catchAll?: string; budgetName?: string; ids?: string; category?: string; dateFrom?: string; dateTo?: string }>
}

export default async function TransactionsPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) redirect('/login')

  const params = await searchParams
  const initialCategoryId = params.categoryId ?? ''
  const initialMonth = params.month ?? ''
  const initialPersonId = params.personId ?? ''
  const initialPropertyId = params.propertyId ?? ''
  const initialAccountId = params.accountId ?? ''
  const initialSearch = params.search ?? ''
  const initialClassification = params.classification ?? ''
  const initialAnnualExpenseId = params.annualExpenseId ?? ''
  const initialAnnualExpenseName = params.annualExpenseName ?? ''
  const initialUncategorized = params.uncategorized === 'true'
  const initialBudgetId = params.budgetId ?? ''
  const initialTier = params.tier ?? ''
  const initialCatchAll = params.catchAll === 'true'
  const initialBudgetName = params.budgetName ?? ''
  const insightIds = params.ids?.split(',').filter(Boolean) ?? []
  const insightCategory = params.category ?? ''
  const insightDateFrom = params.dateFrom ?? ''
  const insightDateTo = params.dateTo ?? ''

  const isBudgetMode = !!(initialBudgetId || initialCatchAll)
  const isInsightView = insightIds.length > 0 || !!(insightCategory && insightDateFrom)
  const PAGE_SIZE = 50

  // Build where clause from URL params for server-side filtering
  const txWhere: Record<string, unknown> = { userId: session.userId }

  // Insight drill-down: filter by specific IDs
  if (insightIds.length > 0) {
    txWhere.id = { in: insightIds }
  }

  // Insight drill-down: filter by category name + date range
  if (insightCategory && insightDateFrom) {
    txWhere.category = { name: insightCategory }
    txWhere.date = {
      gte: new Date(insightDateFrom),
      ...(insightDateTo ? { lte: new Date(insightDateTo + 'T23:59:59.999Z') } : {}),
    }
  }
  if (initialCategoryId) txWhere.categoryId = initialCategoryId
  if (initialMonth) {
    const [y, m] = initialMonth.split('-').map(Number)
    if (y && m) {
      txWhere.date = { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) }
    }
  }
  if (initialAccountId) txWhere.accountId = initialAccountId
  if (initialPersonId && initialPersonId !== '__none__') txWhere.householdMemberId = initialPersonId
  if (initialPropertyId && initialPropertyId !== '__none__' && !initialPropertyId.startsWith('group:')) txWhere.propertyId = initialPropertyId
  if (initialClassification) txWhere.classification = initialClassification
  if (initialUncategorized) txWhere.categoryId = null

  // Unbudgeted filter: transactions in categories that have no budget
  const initialUnbudgeted = params.unbudgeted === 'true'
  if (initialUnbudgeted) {
    const budgetCategoryIds = await db.budget.findMany({
      where: {
        userId: session.userId,
        categoryId: { not: null },
        startDate: { lte: new Date() },
        OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
      },
      select: { categoryId: true },
    })
    const budgetedIds = budgetCategoryIds.map((b) => b.categoryId!).filter(Boolean)
    txWhere.categoryId = { not: null, notIn: budgetedIds }
    txWhere.classification = 'expense'
    txWhere.annualExpenseId = null
  }

  if (initialAnnualExpenseId) txWhere.annualExpenseId = initialAnnualExpenseId
  if (initialSearch) txWhere.merchant = { contains: initialSearch, mode: 'insensitive' }

  // Server-side budget claiming: compute exact transaction IDs for this budget
  let budgetClaimedIds: string[] | null = null
  if (isBudgetMode && initialMonth) {
    const [y, m] = initialMonth.split('-').map(Number)
    if (y && m) {
      const monthStart = new Date(Date.UTC(y, m - 1, 1))
      const monthEnd = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999))

      if (initialBudgetId) {
        const budget = await db.budget.findFirst({
          where: { id: initialBudgetId, userId: session.userId },
          include: { annualExpense: true },
        })

        if (budget) {
          if (budget.tier === 'ANNUAL' && budget.annualExpense) {
            // Annual budgets: filter by annualExpenseId directly
            txWhere.annualExpenseId = budget.annualExpense.id
          } else {
            // Fixed/Flexible/Catch-all: use the claiming engine
            const allTxs = await db.transaction.findMany({
              where: {
                userId: session.userId,
                date: { gte: monthStart, lte: monthEnd },
                classification: 'expense',
                amount: { lt: 0 },
                NOT: { tags: { contains: 'perk_covered' } },
              },
              include: { category: { select: { id: true, name: true } } },
            })

            const allBudgets = await db.budget.findMany({
              where: { userId: session.userId },
              include: { annualExpense: true, category: true },
            })

            const claimableTxs = allTxs.map(tx => ({
              id: tx.id,
              amount: Number(tx.amount),
              merchant: tx.merchant,
              categoryId: tx.categoryId,
              annualExpenseId: tx.annualExpenseId,
              category: tx.category,
              tags: tx.tags,
            }))

            const result = claimTransactions(allBudgets, claimableTxs)

            if (budget.tier === 'FIXED') {
              const txId = result.fixedClaimed.get(initialBudgetId)
              budgetClaimedIds = txId ? [txId] : []
            } else if (budget.tier === 'FLEXIBLE') {
              const isCatchAll = CATCHALL_NAMES.has(budget.name.toLowerCase())
              budgetClaimedIds = isCatchAll
                ? result.catchAllTxIds
                : (result.flexibleClaimed.get(initialBudgetId) ?? [])
            }
          }
        }
      } else if (initialCatchAll) {
        // Catch-all mode without a specific budgetId
        const allTxs = await db.transaction.findMany({
          where: {
            userId: session.userId,
            date: { gte: monthStart, lte: monthEnd },
            classification: 'expense',
            amount: { lt: 0 },
            NOT: { tags: { contains: 'perk_covered' } },
          },
          include: { category: { select: { id: true, name: true } } },
        })

        const allBudgets = await db.budget.findMany({
          where: { userId: session.userId },
          include: { annualExpense: true, category: true },
        })

        const claimableTxs = allTxs.map(tx => ({
          id: tx.id,
          amount: Number(tx.amount),
          merchant: tx.merchant,
          categoryId: tx.categoryId,
          annualExpenseId: tx.annualExpenseId,
          category: tx.category,
          tags: tx.tags,
        }))

        const result = claimTransactions(allBudgets, claimableTxs)
        budgetClaimedIds = result.catchAllTxIds
      }

      // Apply claimed IDs filter
      if (budgetClaimedIds !== null) {
        txWhere.id = { in: budgetClaimedIds }
      }
    }
  }

  const txSelect = {
    id: true, date: true, merchant: true, amount: true, notes: true,
    categoryId: true, accountId: true, householdMemberId: true, propertyId: true,
    classification: true, annualExpenseId: true, isPending: true,
    category: { select: { id: true, name: true } },
    account: { select: { id: true, name: true } },
    householdMember: { select: { id: true, name: true } },
    property: { select: { id: true, name: true } },
    splits: {
      select: {
        id: true, propertyId: true, amount: true,
        property: { select: { id: true, name: true, taxSchedule: true } },
      },
      orderBy: { amount: 'desc' as const },
    },
  }

  const [txTotal, transactions, categories, accounts, householdMembers, properties, propertyGroups] = await Promise.all([
    db.transaction.count({ where: txWhere }),
    db.transaction.findMany({
      where: txWhere,
      select: txSelect,
      orderBy: { date: 'desc' },
      ...(isBudgetMode ? {} : { take: PAGE_SIZE, skip: 0 }),
    }),
    db.category.findMany({
      where: {
        OR: [{ userId: session.userId }, { userId: null, isDefault: true }],
        isActive: true,
      },
      orderBy: [{ group: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, group: true, type: true },
    }),
    db.account.findMany({
      where: { userId: session.userId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, type: true },
    }),
    db.householdMember.findMany({
      where: { userId: session.userId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, isDefault: true },
    }),
    db.property.findMany({
      where: { userId: session.userId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, type: true, isDefault: true, groupId: true },
    }),
    db.propertyGroup.findMany({
      where: { userId: session.userId },
      include: {
        properties: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
      },
      orderBy: { name: 'asc' },
    }),
  ])

  // Detect refund pairs for badge display
  const refundPairIds = findRefundPairs(
    transactions.map(tx => ({ id: tx.id, merchant: tx.merchant, amount: Number(tx.amount), date: tx.date.toISOString(), accountId: tx.accountId, classification: tx.classification }))
  )

  // Serialize dates + Decimal→number for the client component
  const serialized = transactions.map(tx => ({
    id: tx.id,
    date: tx.date.toISOString(),
    merchant: tx.merchant,
    amount: Number(tx.amount),
    notes: tx.notes,
    categoryId: tx.categoryId,
    accountId: tx.accountId,
    householdMemberId: tx.householdMemberId,
    propertyId: tx.propertyId,
    category: tx.category,
    account: tx.account,
    householdMember: tx.householdMember,
    property: tx.property,
    classification: tx.classification,
    annualExpenseId: tx.annualExpenseId,
    isPending: tx.isPending,
    splits: tx.splits.map(s => ({
      id: s.id,
      propertyId: s.propertyId,
      amount: Number(s.amount),
      property: s.property,
    })),
  }))

  const forecastSummary = await getForecastSummaries(session.userId)

  return (
    <div>
      {isBudgetMode && (
        <Link href="/budgets" className="mb-2 inline-flex items-center gap-1 text-sm text-stone hover:text-fjord">
          &larr; Back to Budgets
        </Link>
      )}
      {forecastSummary && (
        <div className="mb-4 rounded-lg border border-pine/20 bg-pine/5 px-4 py-3">
          <span className="text-xs font-medium uppercase text-stone">Spending ↔ Goal</span>
          <p className="text-sm text-fjord">{forecastSummary.transactions}</p>
        </div>
      )}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-fjord">Transactions</h1>
        <div className="flex gap-2 sm:gap-3">
          <Button variant="secondary" href="/transactions/import">
            Import CSV
          </Button>
          <Button href="/transactions/new">
            + Add
          </Button>
        </div>
      </div>

      <DuplicateReview />

      {isInsightView && (
        <div className="mb-4 flex items-center justify-between rounded-card border border-fjord/20 bg-fjord/5 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-fjord">
              Showing transactions related to insight
            </p>
            {insightIds.length > 0 && (
              <p className="text-xs text-stone">{insightIds.length} transaction{insightIds.length !== 1 ? 's' : ''} linked</p>
            )}
            {insightCategory && (
              <p className="text-xs text-stone">Category: {insightCategory}{insightDateFrom ? ` · ${insightDateFrom} to ${insightDateTo || 'now'}` : ''}</p>
            )}
          </div>
          <a href="/transactions" className="text-xs text-stone hover:text-fjord">
            Clear filter
          </a>
        </div>
      )}

      {txTotal === 0 ? (
        <div className="card">
          <EmptyState
            title="No transactions yet"
            description="Add your first income or expense to get started."
            action={{ label: "+ Add transaction", href: "/transactions/new" }}
          />
        </div>
      ) : (
        <TransactionList
          transactions={serialized}
          initialTotal={txTotal}
          categories={categories}
          accounts={accounts}
          householdMembers={householdMembers}
          properties={properties}
          propertyGroups={propertyGroups.map(g => ({
            id: g.id,
            name: g.name,
            propertyIds: g.properties.map(p => p.id),
          }))}
          initialCategoryId={initialCategoryId}
          initialMonth={initialMonth}
          initialPersonId={initialPersonId}
          initialPropertyId={initialPropertyId}
          initialAccountId={initialAccountId}
          initialSearch={initialSearch}
          initialClassification={initialClassification}
          initialAnnualExpenseId={initialAnnualExpenseId}
          initialAnnualExpenseName={initialAnnualExpenseName}
          initialUncategorized={initialUncategorized}
          initialBudgetId={initialBudgetId}
          initialTier={initialTier}
          initialCatchAll={initialCatchAll}
          initialBudgetName={initialBudgetName}
          serverBudgetFiltered={budgetClaimedIds !== null}
          refundedTxIds={[...refundPairIds]}
          isInsightView={isInsightView}
        />
      )}
    </div>
  )
}
