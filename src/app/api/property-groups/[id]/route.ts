import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const group = await db.propertyGroup.findFirst({
    where: { id, userId: session.userId },
    include: {
      properties: { select: { id: true, name: true, type: true, splitPct: true } },
      splitRules: {
        select: { id: true, propertyId: true, allocationPct: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(group)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await db.propertyGroup.findFirst({
    where: { id, userId: session.userId },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { name, description } = body

  // Check for duplicate name on rename (case-insensitive)
  if (name !== undefined && name.trim()) {
    const duplicate = await db.propertyGroup.findFirst({
      where: {
        userId: session.userId,
        name: { equals: name.trim(), mode: 'insensitive' },
        id: { not: id },
      },
    })
    if (duplicate) {
      return NextResponse.json(
        { error: 'A property group with this name already exists' },
        { status: 409 }
      )
    }
  }

  const updated = await db.propertyGroup.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
    },
    include: {
      properties: { select: { id: true, name: true, type: true, splitPct: true } },
      splitRules: {
        select: { id: true, propertyId: true, allocationPct: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await db.propertyGroup.findFirst({
    where: { id, userId: session.userId },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Unlink properties from this group, delete split rules, then delete group
  await db.$transaction([
    db.property.updateMany({
      where: { groupId: id },
      data: { groupId: null, splitPct: null },
    }),
    db.splitRule.deleteMany({
      where: { propertyGroupId: id },
    }),
    db.propertyGroup.delete({ where: { id } }),
  ])

  return new NextResponse(null, { status: 204 })
}
