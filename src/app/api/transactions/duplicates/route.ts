import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { canonicalizeMerchant } from '@/lib/normalize-merchant'

export interface DuplicateGroup {
  canonicalMerchant: string
  amount: number
  date: string
  dismissKey: string
  transactions: {
    id: string
    merchant: string
    amount: number
    date: string
    importSource: string | null
    categoryId: string | null
    categoryName: string | null
    accountId: string | null
    accountName: string | null
    notes: string | null
    plaidTransactionId: string | null
    originalStatement: string | null
    isPending: boolean
  }[]
}

/**
 * GET /api/transactions/duplicates
 * Finds potential duplicate transactions using canonical merchant matching,
 * same amount, and date within ±1 day.
 */
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Load dismissed signatures from UserProfile
    const profile = await db.userProfile.findUnique({
      where: { userId: session.userId },
      select: { dismissedDuplicates: true },
    })
    const dismissedSet = new Set<string>(
      Array.isArray(profile?.dismissedDuplicates)
        ? (profile.dismissedDuplicates as string[])
        : []
    )

    // Load recent transactions (last 90 days)
    const since = new Date()
    since.setDate(since.getDate() - 90)

    const transactions = await db.transaction.findMany({
      where: {
        userId: session.userId,
        date: { gte: since },
      },
      include: {
        category: { select: { name: true } },
        account: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
    })

    // Group by (canonicalMerchant, amount) and find clusters within ±1 day
    const groupKey = (canonical: string, amount: number) =>
      `${canonical}|${amount.toFixed(2)}`

    const groups = new Map<string, typeof transactions>()
    for (const tx of transactions) {
      const canonical = canonicalizeMerchant(tx.merchant)
      const key = groupKey(canonical, tx.amount)
      const arr = groups.get(key) ?? []
      arr.push(tx)
      groups.set(key, arr)
    }

    const duplicateGroups: DuplicateGroup[] = []

    for (const [, txs] of groups) {
      if (txs.length < 2) continue

      // Within this group, find clusters where dates are within ±1 day
      const sorted = txs.sort((a, b) => a.date.getTime() - b.date.getTime())
      const visited = new Set<number>()

      for (let i = 0; i < sorted.length; i++) {
        if (visited.has(i)) continue
        const cluster = [sorted[i]]
        visited.add(i)

        for (let j = i + 1; j < sorted.length; j++) {
          if (visited.has(j)) continue
          const daysDiff = Math.abs(sorted[j].date.getTime() - sorted[i].date.getTime()) / (24 * 60 * 60 * 1000)
          if (daysDiff <= 1) {
            cluster.push(sorted[j])
            visited.add(j)
          }
        }

        if (cluster.length >= 2) {
          // If every transaction has a distinct Plaid ID, Plaid has confirmed
          // they are separate transactions — skip this cluster
          const plaidIds = cluster
            .map(tx => tx.plaidTransactionId)
            .filter(Boolean)
          const uniquePlaidIds = new Set(plaidIds)
          if (plaidIds.length === cluster.length && uniquePlaidIds.size === cluster.length) {
            continue
          }

          // Same-account filter: if ALL transactions are from the same account
          // AND all have distinct Plaid IDs, they're legitimate repeat purchases
          // from the same card (e.g., two coffees at Starbucks)
          const accountIds = cluster.map(tx => tx.accountId).filter(Boolean)
          if (accountIds.length === cluster.length) {
            const uniqueAccounts = new Set(accountIds)
            if (uniqueAccounts.size === 1 && uniquePlaidIds.size === cluster.length && plaidIds.length === cluster.length) {
              continue
            }
          }

          // If every transaction has a distinct originalStatement (raw bank
          // description), they are confirmed-different — skip this cluster
          const origStatements = cluster
            .map(tx => tx.originalStatement)
            .filter(Boolean)
          const uniqueStatements = new Set(origStatements)
          if (origStatements.length === cluster.length && uniqueStatements.size === cluster.length) {
            continue
          }

          // Build stable dismiss key (no transaction IDs — survives re-syncs)
          const dateISO = cluster[0].date.toISOString().split('T')[0]
          const canonical = canonicalizeMerchant(cluster[0].merchant)
          const dismissKey = `${canonical}|${cluster[0].amount.toFixed(2)}|${dateISO}`

          // Skip if previously dismissed
          if (dismissedSet.has(dismissKey)) {
            continue
          }

          duplicateGroups.push({
            canonicalMerchant: canonical,
            amount: cluster[0].amount,
            date: dateISO,
            dismissKey,
            transactions: cluster.map(tx => ({
              id: tx.id,
              merchant: tx.merchant,
              amount: tx.amount,
              date: tx.date.toISOString(),
              importSource: tx.importSource,
              categoryId: tx.categoryId,
              categoryName: tx.category?.name ?? null,
              accountId: tx.accountId,
              accountName: tx.account?.name ?? null,
              notes: tx.notes,
              plaidTransactionId: tx.plaidTransactionId,
              originalStatement: tx.originalStatement,
              isPending: tx.isPending,
            })),
          })
        }
      }
    }

    return NextResponse.json({ duplicateGroups, total: duplicateGroups.length })
  } catch (error) {
    console.error('Duplicate detection failed:', error)
    return NextResponse.json({ error: 'Failed to detect duplicates' }, { status: 500 })
  }
}
