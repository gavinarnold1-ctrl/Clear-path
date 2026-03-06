import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'

interface Params {
  params: Promise<{ id: string }>
}

/**
 * PATCH /api/cards/benefits/:id
 * Update a user card benefit (opt-in/out, mark as used).
 */
export async function PATCH(request: Request, { params }: Params) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Verify ownership
  const benefit = await db.userCardBenefit.findUnique({
    where: { id },
    include: {
      userCard: { select: { userId: true } },
    },
  })

  if (!benefit || benefit.userCard.userId !== session.userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await request.json()

  const data: { isOptedIn?: boolean; usedAmount?: number; notes?: string | null } = {}

  if (typeof body.isOptedIn === 'boolean') {
    data.isOptedIn = body.isOptedIn
  }

  if (typeof body.usedAmount === 'number' && body.usedAmount >= 0) {
    data.usedAmount = body.usedAmount
  }

  if (body.notes !== undefined) {
    data.notes = body.notes ?? null
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const updated = await db.userCardBenefit.update({
    where: { id },
    data,
  })

  return NextResponse.json({ benefit: updated })
}
