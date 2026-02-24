import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const members = await db.householdMember.findMany({
    where: { userId: session.userId },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  })

  return NextResponse.json(members)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, isDefault } = body

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  // If setting as default, unset any existing default
  if (isDefault) {
    await db.householdMember.updateMany({
      where: { userId: session.userId, isDefault: true },
      data: { isDefault: false },
    })
  }

  const member = await db.householdMember.create({
    data: {
      userId: session.userId,
      name: name.trim(),
      isDefault: isDefault ?? false,
    },
  })

  return NextResponse.json(member, { status: 201 })
}
