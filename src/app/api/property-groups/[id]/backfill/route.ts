import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { batchMatchAndSplit } from '@/lib/engines/split'
import type { SplitRuleData, PropertyInfo } from '@/lib/engines/split'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: groupId } = await params

  // Verify group belongs to user and fetch match rules + properties
  const group = await db.propertyGroup.findFirst({
    where: { id: groupId, userId: session.userId },
    include: {
      matchRules: {
        where: { isActive: true },
        select: { id: true, name: true, matchField: true, matchPattern: true, allocations: true, isActive: true },
      },
      properties: {
        select: { id: true, name: true, taxSchedule: true },
      },
    },
  })

  if (!group) {
    return NextResponse.json({ error: 'Property group not found' }, { status: 404 })
  }

  if (group.matchRules.length === 0) {
    return NextResponse.json({ error: 'No active match rules in this group' }, { status: 400 })
  }

  // Build property lookup
  const propertyLookup = new Map<string, PropertyInfo>()
  for (const p of group.properties) {
    propertyLookup.set(p.id, { name: p.name, taxSchedule: p.taxSchedule })
  }

  // Convert match rules to engine format
  const rules: SplitRuleData[] = group.matchRules.map((r) => ({
    id: r.id,
    matchField: r.matchField,
    matchPattern: r.matchPattern,
    allocations: r.allocations as Array<{ propertyId: string; percentage: number }>,
    isActive: r.isActive,
  }))

  // Fetch all user transactions that don't already have splits
  const transactions = await db.transaction.findMany({
    where: {
      userId: session.userId,
      splits: { none: {} },
    },
    select: {
      id: true,
      merchant: true,
      amount: true,
      originalStatement: true,
      category: { select: { name: true } },
    },
    orderBy: { date: 'desc' },
  })

  // Run batch matching
  const txData = transactions.map((tx) => ({
    id: tx.id,
    merchant: tx.merchant,
    amount: tx.amount,
    description: tx.originalStatement,
    categoryName: tx.category?.name,
  }))

  const results = batchMatchAndSplit(txData, rules, propertyLookup)

  // Create TransactionSplit records for all matches
  let created = 0
  if (results.length > 0) {
    const splitRecords = results.flatMap((r) =>
      r.allocations.map((alloc) => ({
        transactionId: r.transactionId,
        propertyId: alloc.propertyId,
        amount: alloc.amount,
      }))
    )

    // Use createMany for bulk insert
    const result = await db.transactionSplit.createMany({
      data: splitRecords,
      skipDuplicates: true,
    })
    created = result.count
  }

  return NextResponse.json({
    matched: results.length,
    splits: created,
    total: transactions.length,
    skipped: transactions.length - results.length,
  })
}
