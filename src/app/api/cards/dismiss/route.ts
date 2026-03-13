import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'

// POST /api/cards/dismiss — dismiss a credit card from card identification
export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { accountId } = body as { accountId?: string }

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 })
    }

    // Verify account belongs to user and is a credit card
    const account = await db.account.findFirst({
      where: { id: accountId, userId: session.userId, type: 'CREDIT_CARD' },
      select: { id: true },
    })

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    await db.account.update({
      where: { id: accountId },
      data: { cardDismissed: true },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Card dismiss error:', error)
    return NextResponse.json({ error: 'Failed to dismiss card' }, { status: 500 })
  }
}
