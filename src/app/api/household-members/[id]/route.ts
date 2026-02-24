import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await db.householdMember.findFirst({
    where: { id, userId: session.userId },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { name, isDefault } = body

  // R10.2a: Duplicate name prevention on rename (case-insensitive)
  if (name !== undefined && name.trim()) {
    const duplicate = await db.householdMember.findFirst({
      where: {
        userId: session.userId,
        name: { equals: name.trim(), mode: 'insensitive' },
        id: { not: id },
      },
    })
    if (duplicate) {
      return NextResponse.json(
        { error: 'A household member with this name already exists' },
        { status: 409 }
      )
    }
  }

  // If setting as default, unset any existing default
  if (isDefault && !existing.isDefault) {
    await db.householdMember.updateMany({
      where: { userId: session.userId, isDefault: true },
      data: { isDefault: false },
    })
  }

  const updated = await db.householdMember.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(isDefault !== undefined && { isDefault }),
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await db.householdMember.findFirst({
    where: { id, userId: session.userId },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Null out transactions referencing this member, then delete
  await db.$transaction([
    db.transaction.updateMany({
      where: { householdMemberId: id },
      data: { householdMemberId: null },
    }),
    db.householdMember.delete({ where: { id } }),
  ])

  return new NextResponse(null, { status: 204 })
}
