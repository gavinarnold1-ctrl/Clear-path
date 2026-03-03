import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { analyzeSpendingProfile, generateBudgetProposal } from '@/lib/budget-builder'
import { getGoalContext } from '@/lib/goal-context'

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const profile = await analyzeSpendingProfile(session.userId)
    const goalContext = await getGoalContext(session.userId)
    const proposal = await generateBudgetProposal(profile, goalContext)

    return NextResponse.json({
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
      proposal,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate budget proposal'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
