import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { type, message, page, metadata } = body

  if (!type || !message) {
    return NextResponse.json({ error: 'Type and message required' }, { status: 400 })
  }

  if (!['bug', 'feature', 'general'].includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }

  if (message.length > 2000) {
    return NextResponse.json({ error: 'Message too long' }, { status: 400 })
  }

  const feedback = await db.feedback.create({
    data: {
      userId: session.userId,
      type,
      message: message.trim(),
      page: page || '/',
      metadata: metadata || null,
    },
  })

  return NextResponse.json({ id: feedback.id, status: 'submitted' })
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const feedback = await db.feedback.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return NextResponse.json({ feedback })
}
