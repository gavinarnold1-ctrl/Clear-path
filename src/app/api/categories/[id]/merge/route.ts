import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

/** POST /api/categories/:sourceId/merge  { targetId: string }
 *  Reassigns all transactions and budgets from source → target, then deletes source.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sourceId } = await params
  const body = await req.json()
  const { targetId } = body

  if (!targetId || targetId === sourceId) {
    return NextResponse.json({ error: 'Invalid target category' }, { status: 400 })
  }

  // Verify source is user-owned (can't merge system defaults)
  const source = await db.category.findFirst({
    where: { id: sourceId, userId: session.userId },
  })
  if (!source) {
    return NextResponse.json({ error: 'Source category not found or not owned by you' }, { status: 404 })
  }

  // Verify target exists and is accessible
  const target = await db.category.findFirst({
    where: {
      id: targetId,
      OR: [{ userId: session.userId }, { userId: null, isDefault: true }],
    },
  })
  if (!target) {
    return NextResponse.json({ error: 'Target category not found' }, { status: 404 })
  }

  // Move all transactions and budgets from source to target, then delete source
  await db.$transaction([
    db.transaction.updateMany({
      where: { categoryId: sourceId, userId: session.userId },
      data: { categoryId: targetId },
    }),
    db.budget.updateMany({
      where: { categoryId: sourceId, userId: session.userId },
      data: { categoryId: targetId },
    }),
    db.category.delete({ where: { id: sourceId } }),
  ])

  return NextResponse.json({ ok: true, merged: { from: sourceId, to: targetId } })
}
