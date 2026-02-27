import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const mappings = await db.userCategoryMapping.findMany({
    where: { userId: session.userId },
    include: { category: { select: { id: true, name: true, type: true, group: true } } },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json(mappings)
}
