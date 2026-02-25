import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { setSession } from '@/lib/session'
import { DEMO_USER_ID } from '@/lib/demo'

export async function POST() {
  const user = await db.user.findUnique({ where: { id: DEMO_USER_ID } })

  if (!user) {
    return NextResponse.json(
      { error: 'Demo account not available. The seed script has not been run.' },
      { status: 500 }
    )
  }

  await setSession({ userId: user.id, email: user.email, name: user.name }, user.refreshTokenVersion)

  return NextResponse.json({ success: true, redirect: '/dashboard' })
}
