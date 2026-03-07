import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { analyzeSpendingProfile, generateBudgetProposal } from '@/lib/budget-builder'
import { getGoalContext } from '@/lib/goal-context'
import { getGeneration, setGeneration } from '@/lib/budget-generation-store'

const INCOME_RANGE_TO_LOW: Record<string, number> = {
  under_50k: 0,
  '50k_100k': 50000,
  '100k_150k': 100000,
  '150k_200k': 150000,
  '200k_300k': 200000,
  over_300k: 300000,
}

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // If there's already a pending generation, return its status
  const existing = getGeneration(session.userId)
  if (existing?.status === 'pending') {
    return NextResponse.json({ status: 'pending' })
  }

  // Mark as pending and start async generation
  setGeneration(session.userId, { status: 'pending', createdAt: Date.now() })

  // Fire and forget — don't await
  generateAsync(session.userId).catch((err) => {
    console.error('Budget generation failed:', err)
    const status = (err as { status?: number })?.status
    const message = status === 529 || status === 503
      ? 'The AI service is temporarily overloaded. Please try again in a minute.'
      : err instanceof Error ? err.message : 'Failed to generate budget proposal'
    setGeneration(session.userId, { status: 'error', error: message, createdAt: Date.now() })
  })

  return NextResponse.json({ status: 'pending' })
}

async function generateAsync(userId: string) {
  const [profile, goalContext, userProfile] = await Promise.all([
    analyzeSpendingProfile(userId),
    getGoalContext(userId),
    db.userProfile.findUnique({
      where: { userId },
      select: { incomeRange: true, householdType: true },
    }),
  ])

  // Fetch BLS benchmarks for the user's income range
  const bracketLow = INCOME_RANGE_TO_LOW[userProfile?.incomeRange ?? ''] ?? null
  let benchmarks = null
  if (bracketLow !== null) {
    benchmarks = await db.spendingBenchmark.findMany({
      where: { incomeRangeLow: bracketLow },
      select: {
        category: true,
        appCategory: true,
        monthlyMean: true,
        annualMedian: true,
        shareOfTotal: true,
      },
    })
  }

  const proposal = await generateBudgetProposal(profile, goalContext, benchmarks)

  setGeneration(userId, {
    status: 'complete',
    proposal,
    profile: {
      totalMonthlyIncome: profile.totalMonthlyIncome,
      averageMonthlyExpenses: profile.averageMonthlyExpenses,
      monthsOfData: profile.monthsOfData,
      totalTransactions: profile.totalTransactions,
      savingsRate: profile.savingsRate,
      incomeStreams: profile.incomeStreams.length,
      detectedFixed: profile.detectedFixed.length,
      variableCategories: profile.variableByCategory.length,
    },
    goalContext: goalContext
      ? { goalLabel: goalContext.goalLabel, primaryGoal: goalContext.primaryGoal }
      : null,
    createdAt: Date.now(),
  })
}
