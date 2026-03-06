import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = (body.email ?? '').trim().toLowerCase()

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
    }

    const existing = await db.waitlistEntry.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ message: "You're already on the list!" }, { status: 409 })
    }

    await db.waitlistEntry.create({
      data: { email, source: body.source ?? 'landing' },
    })

    return NextResponse.json({ message: 'Welcome to the waitlist!' }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
