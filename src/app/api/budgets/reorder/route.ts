import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { orderedIds } = body as { orderedIds: string[] }

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return NextResponse.json({ error: 'orderedIds array is required' }, { status: 400 })
  }

  // Verify all budgets belong to the user
  const budgets = await db.budget.findMany({
    where: { id: { in: orderedIds }, userId: session.userId },
    select: { id: true },
  })
  const validIds = new Set(budgets.map(b => b.id))

  const updates = orderedIds
    .filter(id => validIds.has(id))
    .map((id, index) =>
      db.budget.update({
        where: { id },
        data: { sortOrder: index },
      })
    )

  await db.$transaction(updates)

  return NextResponse.json({ success: true })
}
