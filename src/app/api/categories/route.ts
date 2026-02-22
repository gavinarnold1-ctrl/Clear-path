import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

const VALID_TYPES = new Set(['INCOME', 'EXPENSE', 'TRANSFER'])

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') ?? undefined

  if (type && !VALID_TYPES.has(type)) {
    return NextResponse.json({ error: 'Invalid type filter' }, { status: 400 })
  }

  // Return both user-specific and system default categories
  const categories = await db.category.findMany({
    where: {
      OR: [{ userId: session.userId }, { userId: null, isDefault: true }],
      isActive: true,
      ...(type && { type: type as 'INCOME' | 'EXPENSE' | 'TRANSFER' }),
    },
    orderBy: [{ group: 'asc' }, { name: 'asc' }],
  })

  return NextResponse.json(categories)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, color, icon, type, group } = body

  if (!name || !type) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  if (!VALID_TYPES.has(type)) return NextResponse.json({ error: 'Invalid category type' }, { status: 400 })
  if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return NextResponse.json({ error: 'Invalid color — use a 6-digit hex code like #6366f1' }, { status: 400 })
  }

  const category = await db.category.create({
    data: {
      userId: session.userId,
      name,
      color: color ?? '#6366f1',
      icon: icon ?? null,
      type,
      group: group ?? 'Miscellaneous',
      isDefault: false,
    },
  })

  return NextResponse.json(category, { status: 201 })
}
