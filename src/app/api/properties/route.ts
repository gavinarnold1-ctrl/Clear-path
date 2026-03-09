import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import type { PropertyType, TaxSchedule } from '@prisma/client'

const VALID_TYPES = new Set<string>(['PERSONAL', 'RENTAL', 'BUSINESS'])

const TAX_SCHEDULE_MAP: Record<string, TaxSchedule> = {
  PERSONAL: 'SCHEDULE_A',
  RENTAL: 'SCHEDULE_E',
  BUSINESS: 'SCHEDULE_C',
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const properties = await db.property.findMany({
    where: { userId: session.userId },
    include: { group: { select: { id: true, name: true } } },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  })

  return NextResponse.json(properties, {
    headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
  })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    name, type, isDefault,
    address, city, state, zipCode,
    taxSchedule,
    purchasePrice, purchaseDate, buildingValuePct, priorDepreciation,
    groupId, splitPct,
  } = body

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  if (!type || !VALID_TYPES.has(type)) {
    return NextResponse.json({ error: 'Type must be PERSONAL, RENTAL, or BUSINESS' }, { status: 400 })
  }

  // Check for duplicate name (case-insensitive)
  const existing = await db.property.findFirst({
    where: {
      userId: session.userId,
      name: { equals: name.trim(), mode: 'insensitive' },
    },
  })
  if (existing) {
    return NextResponse.json(
      { error: 'A property with this name already exists' },
      { status: 409 }
    )
  }

  // Validate groupId belongs to the user
  if (groupId) {
    const group = await db.propertyGroup.findFirst({
      where: { id: groupId, userId: session.userId },
    })
    if (!group) {
      return NextResponse.json({ error: 'Property group not found' }, { status: 404 })
    }
  }

  // If setting as default, unset any existing default
  if (isDefault) {
    await db.property.updateMany({
      where: { userId: session.userId, isDefault: true },
      data: { isDefault: false },
    })
  }

  // Auto-set taxSchedule from type if not explicitly provided
  const resolvedTaxSchedule: TaxSchedule | null = taxSchedule ?? TAX_SCHEDULE_MAP[type as string] ?? null

  const property = await db.property.create({
    data: {
      userId: session.userId,
      name: name.trim(),
      type: type as PropertyType,
      isDefault: isDefault ?? false,
      // Address fields
      ...(address !== undefined && { address: address?.trim() || null }),
      ...(city !== undefined && { city: city?.trim() || null }),
      ...(state !== undefined && { state: state?.trim() || null }),
      ...(zipCode !== undefined && { zipCode: zipCode?.trim() || null }),
      // Tax schedule
      taxSchedule: resolvedTaxSchedule,
      // Depreciation fields
      ...(purchasePrice !== undefined && { purchasePrice }),
      ...(purchaseDate !== undefined && { purchaseDate: purchaseDate ? new Date(purchaseDate) : null }),
      ...(buildingValuePct !== undefined && { buildingValuePct }),
      ...(priorDepreciation !== undefined && { priorDepreciation }),
      // Group membership
      ...(groupId !== undefined && { groupId: groupId || null }),
      ...(splitPct !== undefined && { splitPct }),
    },
    include: { group: { select: { id: true, name: true } } },
  })

  return NextResponse.json(property, { status: 201 })
}
