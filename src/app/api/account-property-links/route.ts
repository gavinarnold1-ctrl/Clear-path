import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const links = await db.accountPropertyLink.findMany({
    where: {
      account: { userId: session.userId },
    },
    include: {
      account: { select: { id: true, name: true } },
      property: { select: { id: true, name: true, type: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(links)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { accountId, propertyId } = body

  if (!accountId || typeof accountId !== 'string') {
    return NextResponse.json({ error: 'accountId is required' }, { status: 400 })
  }
  if (!propertyId || typeof propertyId !== 'string') {
    return NextResponse.json({ error: 'propertyId is required' }, { status: 400 })
  }

  // Verify ownership
  const account = await db.account.findFirst({
    where: { id: accountId, userId: session.userId },
  })
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  const property = await db.property.findFirst({
    where: { id: propertyId, userId: session.userId },
  })
  if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 })

  // Check for existing link
  const existing = await db.accountPropertyLink.findFirst({
    where: { accountId, propertyId },
  })
  if (existing) {
    return NextResponse.json({ error: 'This account-property link already exists' }, { status: 409 })
  }

  const link = await db.accountPropertyLink.create({
    data: { accountId, propertyId },
    include: {
      account: { select: { id: true, name: true } },
      property: { select: { id: true, name: true, type: true } },
    },
  })

  return NextResponse.json(link, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const linkId = searchParams.get('id')

  if (!linkId) {
    return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 })
  }

  // Verify ownership through account relation
  const link = await db.accountPropertyLink.findFirst({
    where: { id: linkId },
    include: { account: { select: { userId: true } } },
  })
  if (!link || link.account.userId !== session.userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await db.accountPropertyLink.delete({ where: { id: linkId } })
  return new NextResponse(null, { status: 204 })
}
