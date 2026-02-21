import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId') // TODO: replace with session user ID

  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accounts = await db.account.findMany({
    where: { userId },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(accounts)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { userId, name, type, balance, currency } = body

  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const account = await db.account.create({
    data: { userId, name, type, balance: balance ?? 0, currency: currency ?? 'USD' },
  })

  return NextResponse.json(account, { status: 201 })
}
