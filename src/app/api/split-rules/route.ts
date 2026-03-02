import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { Decimal } from '@prisma/client/runtime/library'

/**
 * GET /api/split-rules?groupId=xxx
 * Returns all split rules for a property group.
 */
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const groupId = req.nextUrl.searchParams.get('groupId')
  if (!groupId) {
    return NextResponse.json({ error: 'groupId query parameter is required' }, { status: 400 })
  }

  // Verify group belongs to user
  const group = await db.propertyGroup.findFirst({
    where: { id: groupId, userId: session.userId },
  })
  if (!group) {
    return NextResponse.json({ error: 'Property group not found' }, { status: 404 })
  }

  const rules = await db.splitRule.findMany({
    where: { propertyGroupId: groupId },
    include: { property: { select: { id: true, name: true, type: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(rules)
}

/**
 * POST /api/split-rules
 * Bulk-set split rules for a property group.
 * Body: { groupId: string, allocations: [{ propertyId: string, allocationPct: number }] }
 * Validation: allocations must sum to exactly 100, propertyIds must belong to the group.
 */
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { groupId, allocations } = body

  if (!groupId || typeof groupId !== 'string') {
    return NextResponse.json({ error: 'groupId is required' }, { status: 400 })
  }
  if (!Array.isArray(allocations) || allocations.length === 0) {
    return NextResponse.json({ error: 'allocations array is required and must not be empty' }, { status: 400 })
  }

  // Verify group belongs to user
  const group = await db.propertyGroup.findFirst({
    where: { id: groupId, userId: session.userId },
    include: { properties: { select: { id: true } } },
  })
  if (!group) {
    return NextResponse.json({ error: 'Property group not found' }, { status: 404 })
  }

  // Validate each allocation entry
  const groupPropertyIds = new Set(group.properties.map((p) => p.id))
  let totalPct = new Decimal(0)

  for (const alloc of allocations) {
    if (!alloc.propertyId || typeof alloc.propertyId !== 'string') {
      return NextResponse.json({ error: 'Each allocation must have a propertyId' }, { status: 400 })
    }
    if (typeof alloc.allocationPct !== 'number' || alloc.allocationPct < 0 || alloc.allocationPct > 100) {
      return NextResponse.json(
        { error: `allocationPct must be between 0 and 100 for property ${alloc.propertyId}` },
        { status: 400 }
      )
    }
    if (!groupPropertyIds.has(alloc.propertyId)) {
      return NextResponse.json(
        { error: `Property ${alloc.propertyId} does not belong to this group` },
        { status: 400 }
      )
    }
    totalPct = totalPct.add(new Decimal(alloc.allocationPct))
  }

  // Check uniqueness of propertyIds in the request
  const seenIds = new Set<string>()
  for (const alloc of allocations) {
    if (seenIds.has(alloc.propertyId)) {
      return NextResponse.json(
        { error: `Duplicate propertyId: ${alloc.propertyId}` },
        { status: 400 }
      )
    }
    seenIds.add(alloc.propertyId)
  }

  // Validate allocations sum to 100
  if (!totalPct.equals(new Decimal(100))) {
    return NextResponse.json(
      { error: `Allocations must sum to 100. Current sum: ${totalPct.toNumber()}` },
      { status: 400 }
    )
  }

  // Delete existing rules and create new ones in a transaction
  const operations = [
    db.splitRule.deleteMany({ where: { propertyGroupId: groupId } }),
    ...allocations.map((alloc: { propertyId: string; allocationPct: number }) =>
      db.splitRule.create({
        data: {
          propertyGroupId: groupId,
          propertyId: alloc.propertyId,
          allocationPct: alloc.allocationPct,
        },
      })
    ),
  ]

  await db.$transaction(operations)

  // Return the newly created rules
  const rules = await db.splitRule.findMany({
    where: { propertyGroupId: groupId },
    include: { property: { select: { id: true, name: true, type: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(rules, { status: 201 })
}
