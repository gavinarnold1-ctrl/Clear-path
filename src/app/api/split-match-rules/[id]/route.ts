import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

const VALID_MATCH_FIELDS = new Set(['merchant', 'category', 'description'])

async function findOwnedRule(id: string, userId: string) {
  return db.splitMatchRule.findFirst({
    where: { id },
    include: { propertyGroup: { select: { userId: true, id: true } } },
  }).then((rule) => {
    if (!rule || rule.propertyGroup.userId !== userId) return null
    return rule
  })
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const rule = await findOwnedRule(id, session.userId)
  if (!rule) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(rule)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const rule = await findOwnedRule(id, session.userId)
  if (!rule) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { name, matchField, matchPattern, allocations, isActive } = body

  if (matchField !== undefined && !VALID_MATCH_FIELDS.has(matchField)) {
    return NextResponse.json({ error: 'matchField must be merchant, category, or description' }, { status: 400 })
  }

  if (matchPattern !== undefined && (!matchPattern || !matchPattern.trim())) {
    return NextResponse.json({ error: 'Match pattern cannot be empty' }, { status: 400 })
  }

  // Validate allocations if provided
  if (allocations !== undefined) {
    if (!Array.isArray(allocations) || allocations.length === 0) {
      return NextResponse.json({ error: 'allocations array must not be empty' }, { status: 400 })
    }

    const group = await db.propertyGroup.findFirst({
      where: { id: rule.propertyGroupId },
      include: { properties: { select: { id: true } } },
    })
    const groupPropertyIds = new Set(group!.properties.map((p) => p.id))
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
  }

  // Validate unique name within group if renaming
  if (name !== undefined && name.trim()) {
    const duplicate = await db.splitMatchRule.findFirst({
      where: {
        propertyGroupId: rule.propertyGroupId,
        name: { equals: name.trim(), mode: 'insensitive' },
        id: { not: id },
      },
    })
    if (duplicate) {
      return NextResponse.json({ error: 'A rule with this name already exists in this group' }, { status: 409 })
    }
  }

  const updated = await db.splitMatchRule.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(matchField !== undefined && { matchField }),
      ...(matchPattern !== undefined && { matchPattern: matchPattern.trim() }),
      ...(allocations !== undefined && { allocations }),
      ...(isActive !== undefined && { isActive }),
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const rule = await findOwnedRule(id, session.userId)
  if (!rule) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.splitMatchRule.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
