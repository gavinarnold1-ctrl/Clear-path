import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const transaction = await db.transaction.findUnique({
    where: { id, userId: session.userId },
    include: { account: true, category: true },
  })
  if (!transaction) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(transaction)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  // Verify ownership before update
  const existing = await db.transaction.findUnique({ where: { id, userId: session.userId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const transaction = await db.transaction.update({
    where: { id },
    data: {
      ...(body.amount !== undefined && { amount: body.amount }),
      ...(body.merchant && { merchant: body.merchant }),
      ...(body.date && { date: new Date(body.date) }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.categoryId !== undefined && { categoryId: body.categoryId }),
      ...(body.accountId !== undefined && { accountId: body.accountId }),
      ...(body.tags !== undefined && { tags: body.tags }),
      ...(body.originalStatement !== undefined && { originalStatement: body.originalStatement }),
    },
    include: { account: true, category: true },
  })
  return NextResponse.json(transaction)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  // userId in where clause ensures ownership
  const existing = await db.transaction.findUnique({ where: { id, userId: session.userId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.transaction.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
