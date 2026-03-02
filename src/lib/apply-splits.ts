import { db } from '@/lib/db'
import { matchSplitRule, applySplit } from '@/lib/engines/split'
import type { SplitRuleData, PropertyInfo } from '@/lib/engines/split'

/**
 * Auto-apply property attribution splits to a transaction.
 *
 * Logic:
 * 1. If the transaction has a propertyId, check if that property belongs to a group.
 * 2. If it has a group, check match rules (by merchant, category, description).
 * 3. If a match rule matches, use its allocations.
 * 4. Otherwise, fall back to the group's default split percentages.
 * 5. Create TransactionSplit records for the transaction.
 *
 * @param transactionId - The ID of the created transaction
 * @param propertyId - The property assigned to the transaction (nullable)
 * @param amount - The transaction amount (signed)
 * @param merchant - The merchant name
 * @param categoryName - Optional category name for matching
 * @param description - Optional description/original statement for matching
 * @param tx - Optional Prisma transaction client (for use within $transaction)
 */
export async function applyPropertyAttribution(
  transactionId: string,
  propertyId: string | null,
  amount: number,
  merchant: string,
  categoryName?: string | null,
  description?: string | null,
  tx?: Parameters<Parameters<typeof db.$transaction>[0]>[0]
): Promise<void> {
  if (!propertyId) return

  const prisma = tx ?? db

  // Check if the property belongs to a group
  const property = await prisma.property.findFirst({
    where: { id: propertyId },
    select: { groupId: true },
  })
  if (!property?.groupId) return

  // Load group with properties and match rules
  const group = await prisma.propertyGroup.findFirst({
    where: { id: property.groupId },
    include: {
      properties: { select: { id: true, name: true, splitPct: true, taxSchedule: true } },
      matchRules: {
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!group || group.properties.length === 0) return

  // Build property lookup
  const propertyLookup = new Map<string, PropertyInfo>()
  for (const p of group.properties) {
    propertyLookup.set(p.id, {
      name: p.name,
      taxSchedule: p.taxSchedule,
    })
  }

  // Try match rules first
  const rules: SplitRuleData[] = group.matchRules.map(r => ({
    id: r.id,
    matchField: r.matchField,
    matchPattern: r.matchPattern,
    allocations: r.allocations as Array<{ propertyId: string; percentage: number }>,
    isActive: r.isActive,
  }))

  const matchedRule = matchSplitRule(
    { merchant, description, categoryName: categoryName ?? undefined },
    rules
  )

  let allocations: Array<{ propertyId: string; percentage: number }>

  if (matchedRule) {
    allocations = matchedRule.allocations
  } else {
    // Fall back to group's default split percentages
    const defaultAllocs = group.properties
      .filter(p => p.splitPct !== null && Number(p.splitPct) > 0)
      .map(p => ({ propertyId: p.id, percentage: Number(p.splitPct) }))

    // Only use defaults if they sum to ~100%
    const totalPct = defaultAllocs.reduce((sum, a) => sum + a.percentage, 0)
    if (defaultAllocs.length === 0 || Math.abs(totalPct - 100) > 0.01) return
    allocations = defaultAllocs
  }

  // Apply the split with penny-perfect rounding
  const splitResults = applySplit(amount, allocations, propertyLookup)

  if (splitResults.length > 0) {
    const splitData = splitResults
      .filter(s => s.amount !== 0)
      .map(s => ({
        transactionId,
        propertyId: s.propertyId,
        amount: s.amount,
      }))

    if (splitData.length > 0) {
      await prisma.transactionSplit.createMany({
        data: splitData,
        skipDuplicates: true,
      })
    }
  }
}
