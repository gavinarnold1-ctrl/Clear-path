import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId') // TODO: replace with session user ID
  const type = searchParams.get('type') ?? undefined

  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const categories = await db.category.findMany({
    where: {
      userId,
      ...(type && { type: type as 'INCOME' | 'EXPENSE' | 'TRANSFER' }),
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(categories)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { userId, name, color, icon, type } = body

  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const category = await db.category.create({
    data: { userId, name, color: color ?? '#6366f1', icon, type },
  })

  return NextResponse.json(category, { status: 201 })
}
