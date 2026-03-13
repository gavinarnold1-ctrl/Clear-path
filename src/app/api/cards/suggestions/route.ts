import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { identifyCardPrograms } from '@/lib/card-identification'
import { db } from '@/lib/db'
import { seedCardPrograms } from '../../../../../prisma/seed-card-programs'

// GET /api/cards/suggestions — get card program suggestions for unidentified credit cards
export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Auto-seed card programs if table is empty (handles fresh production deploys)
    const programCount = await db.cardProgram.count()
    if (programCount === 0) {
      try {
        await seedCardPrograms(db)
        console.log('Auto-seeded card programs on first API access')
      } catch (seedErr) {
        console.error('Failed to auto-seed card programs:', seedErr)
      }
    }

    const suggestions = await identifyCardPrograms(session.userId)

    // Also return all available card programs for manual selection
    const programs = await db.cardProgram.findMany({
      where: { isActive: true },
      include: { benefits: { where: { isActive: true }, orderBy: { type: 'asc' } } },
      orderBy: [{ issuer: 'asc' }, { name: 'asc' }],
    })

    // Return unidentified credit card accounts (those without auto-match suggestions)
    const suggestedAccountIds = new Set(suggestions.map((s) => s.accountId))
    const unidentifiedAccounts = await db.account.findMany({
      where: {
        userId: session.userId,
        type: 'CREDIT_CARD',
        userCard: null,
        id: { notIn: Array.from(suggestedAccountIds) },
      },
      select: { id: true, name: true, institution: true },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({
      suggestions,
      programs,
      unidentifiedAccounts,
      ...(programs.length === 0 && {
        message: 'No card programs found. You can still manually select your card from the list below.',
      }),
    })
  } catch (error) {
    console.error('Card suggestions error:', error)
    return NextResponse.json(
      { error: 'Failed to load card suggestions' },
      { status: 500 },
    )
  }
}
