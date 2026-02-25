import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { seedDemoData } from '@/lib/seed-demo'

export async function GET(req: NextRequest) {
  // Verify request is from Vercel Cron (production) or allow in development
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (process.env.NODE_ENV === 'production' && !cronSecret) {
    console.error('CRON_SECRET is not set in production')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await seedDemoData(db)
    return NextResponse.json({ success: true, message: 'Demo data reset complete' })
  } catch (error) {
    console.error('Demo reset failed:', error)
    return NextResponse.json(
      { error: 'Failed to reset demo data' },
      { status: 500 }
    )
  }
}
