import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

const VALID_MATCH_FIELDS = new Set(['merchant', 'category', 'description'])

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const groupId = req.nextUrl.searchParams.get('groupId')
  if (!groupId) {
    return NextResponse.json({ error: 'groupId query parameter is required' }, { status: 400 })
  }

  const group = await db.propertyGroup.findFirst({
    where: { id: groupId, userId: session.userId },
  })
  if (!group) {
    return NextResponse.json({ error: 'Property group not found' }, { status: 404 })
  }

  const rules = await db.splitMatchRule.findMany({
    where: { propertyGroupId: groupId },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(rules)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { groupId, name, matchField, matchPattern, allocations, isActive } = body

  if (!groupId || typeof groupId !== 'string') {
    return NextResponse.json({ error: 'groupId is required' }, { status: 400 })
  }
  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  if (!matchField || !VALID_MATCH_FIELDS.has(matchField)) {
    return NextResponse.json({ error: 'matchField must be merchant, category, or description' }, { status: 400 })
  }
  if (!matchPattern || typeof matchPattern !== 'string' || !matchPattern.trim()) {
    return NextResponse.json({ error: 'Match pattern cannot be empty' }, { status: 400 })
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

  // Validate allocations sum to 100
  const groupPropertyIds = new Set(group.properties.map((p) => p.id))
  let totalPct = 0
  const seenIds = new Set<string>()

  for (const alloc of allocations) {
    if (!alloc.propertyId || typeof alloc.propertyId !== 'string') {
      return NextResponse.json({ error: 'Each allocation must have a propertyId' }, { status: 400 })
    }
    if (typeof alloc.percentage !== 'number' || alloc.percentage < 0 || alloc.percentage > 100) {
      return NextResponse.json({ error: 'percentage must be between 0 and 100' }, { status: 400 })
    }
    if (!groupPropertyIds.has(alloc.propertyId)) {
      return NextResponse.json({ error: `Property ${alloc.propertyId} does not belong to this group` }, { status: 400 })
    }
    if (seenIds.has(alloc.propertyId)) {
      return NextResponse.json({ error: `Duplicate propertyId: ${alloc.propertyId}` }, { status: 400 })
    }
    seenIds.add(alloc.propertyId)
    totalPct += alloc.percentage
  }

  if (Math.abs(totalPct - 100) > 0.01) {
    return NextResponse.json({ error: `Allocations must sum to 100. Current sum: ${totalPct}` }, { status: 400 })
  }

  // Check unique name within group
  const existing = await db.splitMatchRule.findFirst({
    where: {
      propertyGroupId: groupId,
      name: { equals: name.trim(), mode: 'insensitive' },
    },
  })
  if (existing) {
    return NextResponse.json({ error: 'A rule with this name already exists in this group' }, { status: 409 })
  }

  const rule = await db.splitMatchRule.create({
    data: {
      propertyGroupId: groupId,
      name: name.trim(),
      matchField,
      matchPattern: matchPattern.trim(),
      allocations,
      isActive: isActive ?? true,
    },
  })

  return NextResponse.json(rule, { status: 201 })
}
