import { NextRequest, NextResponse } from 'next/server'
import { getSession, clearSession } from '@/lib/session'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/password'

// POST delete account permanently
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { password } = body as { password?: string }

  if (!password) {
    return NextResponse.json({ error: 'Password is required to confirm deletion.' }, { status: 400 })
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { password: true },
  })

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const isValid = await verifyPassword(password, user.password)
  if (!isValid) {
    return NextResponse.json({ error: 'Password is incorrect.' }, { status: 403 })
  }

  // Cascade delete removes all user data (transactions, budgets, accounts, etc.)
  await db.user.delete({ where: { id: session.userId } })

  await clearSession()

  return NextResponse.json({ success: true })
}
