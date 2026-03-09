import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const groups = await db.propertyGroup.findMany({
    where: { userId: session.userId },
    include: {
      properties: { select: { id: true, name: true, type: true, splitPct: true } },
      splitRules: {
        select: { id: true, propertyId: true, allocationPct: true },
        orderBy: { createdAt: 'asc' },
      },
      matchRules: {
        select: { id: true, name: true, matchField: true, matchPattern: true, allocations: true, isActive: true },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(groups, {
    headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
  })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, description } = body

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  // Check for duplicate name (case-insensitive)
  const existing = await db.propertyGroup.findFirst({
    where: {
      userId: session.userId,
      name: { equals: name.trim(), mode: 'insensitive' },
    },
  })
  if (existing) {
    return NextResponse.json(
      { error: 'A property group with this name already exists' },
      { status: 409 }
    )
  }

  const group = await db.propertyGroup.create({
    data: {
      userId: session.userId,
      name: name.trim(),
      description: description?.trim() || null,
    },
    include: {
      properties: { select: { id: true, name: true, type: true, splitPct: true } },
      splitRules: { select: { id: true, propertyId: true, allocationPct: true } },
      matchRules: { select: { id: true, name: true, matchField: true, matchPattern: true, allocations: true, isActive: true } },
    },
  })

  return NextResponse.json(group, { status: 201 })
}
