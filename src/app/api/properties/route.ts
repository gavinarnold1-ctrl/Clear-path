import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

const VALID_TYPES = new Set(['PERSONAL', 'RENTAL'])

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const properties = await db.property.findMany({
    where: { userId: session.userId },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  })

  return NextResponse.json(properties)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, type, isDefault } = body

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  if (!type || !VALID_TYPES.has(type)) {
    return NextResponse.json({ error: 'Type must be PERSONAL or RENTAL' }, { status: 400 })
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

  // If setting as default, unset any existing default
  if (isDefault) {
    await db.property.updateMany({
      where: { userId: session.userId, isDefault: true },
      data: { isDefault: false },
    })
  }

  const property = await db.property.create({
    data: {
      userId: session.userId,
      name: name.trim(),
      type,
      isDefault: isDefault ?? false,
    },
  })

  return NextResponse.json(property, { status: 201 })
}
