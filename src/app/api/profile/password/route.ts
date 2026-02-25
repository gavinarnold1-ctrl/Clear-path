import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { hashPassword, verifyPassword } from '@/lib/password'
import { changePasswordSchema, validateBody } from '@/lib/validation'

// POST change password
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = validateBody(changePasswordSchema, body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { currentPassword, newPassword } = parsed.data

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { password: true },
  })

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const isValid = await verifyPassword(currentPassword, user.password)
  if (!isValid) {
    return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 403 })
  }

  await db.user.update({
    where: { id: session.userId },
    data: { password: await hashPassword(newPassword) },
  })

  return NextResponse.json({ success: true })
}
