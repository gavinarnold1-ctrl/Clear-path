import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

const VALID_TYPES = new Set(['income', 'expense', 'transfer', 'perk_reimbursement'])

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { name, group, icon, type } = body

  // Verify ownership — only user-created categories can be edited
  const existing = await db.category.findFirst({
    where: { id, userId: session.userId },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Category not found or not editable' }, { status: 404 })
  }

  if (type && !VALID_TYPES.has(type)) {
    return NextResponse.json({ error: 'Invalid category type' }, { status: 400 })
  }

  const updated = await db.category.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(group !== undefined && { group: group.trim() }),
      ...(icon !== undefined && { icon: icon || null }),
      ...(type !== undefined && { type }),
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const reassignTo = searchParams.get('reassignTo') // optional category id to move transactions to

  // Verify ownership
  const existing = await db.category.findFirst({
    where: { id, userId: session.userId },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Category not found or not deletable' }, { status: 404 })
  }

  if (reassignTo) {
    // Verify reassignment target exists and belongs to user or is a system default
    const target = await db.category.findFirst({
      where: {
        id: reassignTo,
        OR: [{ userId: session.userId }, { userId: null, isDefault: true }],
      },
    })
    if (!target) {
      return NextResponse.json({ error: 'Reassignment target not found' }, { status: 404 })
    }

    await db.$transaction([
      db.transaction.updateMany({
        where: { categoryId: id, userId: session.userId },
        data: { categoryId: reassignTo },
      }),
      db.budget.updateMany({
        where: { categoryId: id, userId: session.userId },
        data: { categoryId: reassignTo },
      }),
      db.category.delete({ where: { id } }),
    ])
  } else {
    // Uncategorize transactions, then delete
    await db.$transaction([
      db.transaction.updateMany({
        where: { categoryId: id, userId: session.userId },
        data: { categoryId: null },
      }),
      db.budget.deleteMany({
        where: { categoryId: id, userId: session.userId },
      }),
      db.category.delete({ where: { id } }),
    ])
  }

  return NextResponse.json({ ok: true })
}
