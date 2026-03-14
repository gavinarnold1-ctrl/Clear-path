import { db } from './db'
import type { IncomeTransition } from '@/types'

export interface GoalContext {
  primaryGoal: string
  goalLabel: string
  goalSetAt: Date | null
  guidanceForAI: string
  goalTarget?: {
    description: string
    monthlyNeeded?: number
    targetValue?: number
    metric?: string
  } | null
  incomeTransitionContext?: string | null
}

const GOAL_GUIDANCE: Record<string, { label: string; guidance: string }> = {
  save_more: {
    label: 'Save More',
    guidance:
      'User wants to increase savings rate. Prioritize: finding cuts in flexible spending, optimizing fixed costs, building emergency fund. Frame insights around "money freed up" and savings rate improvement. True Remaining should feel like progress toward a savings target.',
  },
  spend_smarter: {
    label: 'Spend Smarter',
    guidance:
      'User wants better value from spending, not necessarily less spending. Prioritize: cost-per-use analysis, subscription audits, comparison shopping opportunities, quality-vs-quantity tradeoffs. Don\'t shame spending — help optimize it.',
  },
  pay_off_debt: {
    label: 'Pay Off Debt',
    guidance:
      'User wants to accelerate debt payoff. Prioritize: finding extra money for debt payments, interest cost awareness, debt snowball/avalanche comparisons, timeline projections. Frame flexible budget cuts as "extra toward debt" not just savings.',
  },
  gain_visibility: {
    label: 'Gain Visibility',
    guidance:
      'User is new to tracking and wants to understand their money. Prioritize: pattern identification, "did you know" insights, category breakdowns, spending trends over time. Be educational and exploratory — avoid overwhelming with optimization suggestions.',
  },
  build_wealth: {
    label: 'Build Wealth',
    guidance:
      'User is beyond basics and focused on long-term growth. Prioritize: investment opportunity cost of spending, tax optimization, savings rate vs wealth-building benchmarks, asset allocation awareness. Can be more sophisticated in financial concepts.',
  },
}

export async function getGoalContext(userId: string): Promise<GoalContext | null> {
  const profile = await db.userProfile.findUnique({
    where: { userId },
    select: { primaryGoal: true, goalSetAt: true, goalTarget: true, incomeTransitions: true, expectedMonthlyIncome: true },
  })

  if (!profile?.primaryGoal) return null

  const config = GOAL_GUIDANCE[profile.primaryGoal]
  if (!config) return null

  const gt = profile.goalTarget as { description?: string; monthlyNeeded?: number; targetValue?: number; metric?: string } | null

  // Build income transition context for AI
  const transitions = profile.incomeTransitions as IncomeTransition[] | null
  let incomeTransitionContext: string | null = null
  if (transitions && transitions.length > 0) {
    const now = new Date()
    const futureTransitions = transitions
      .filter((t) => new Date(t.date) > now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    if (futureTransitions.length > 0) {
      const next = futureTransitions[0]
      const currentIncome = profile.expectedMonthlyIncome ?? 0
      const monthsUntil = Math.max(0, Math.round((new Date(next.date).getTime() - now.getTime()) / (30.44 * 24 * 60 * 60 * 1000)))
      const multiplier = currentIncome > 0 ? (next.monthlyIncome / currentIncome).toFixed(1) : '?'

      incomeTransitionContext = [
        `INCOME TRANSITION CONTEXT:`,
        `User has a planned income change: "${next.label}"`,
        `Current: $${Math.round(currentIncome).toLocaleString()}/mo → Expected: $${Math.round(next.monthlyIncome).toLocaleString()}/mo (${multiplier}x)`,
        `Effective: ${new Date(next.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} (${monthsUntil} months from now)`,
        futureTransitions.length > 1 ? `${futureTransitions.length - 1} additional transition(s) planned after this.` : '',
        ``,
        `IMPORTANT: Do NOT recommend aggressive spending cuts for someone whose income is about to change significantly. Focus on:`,
        `- Minimizing high-interest debt before the income jump`,
        `- Building habits that scale with higher income`,
        `- Planning for lifestyle inflation resistance ("stealth wealth")`,
        `- Directing a specific percentage of the raise toward financial goals`,
      ].filter(Boolean).join('\n')
    }
  }

  return {
    primaryGoal: profile.primaryGoal,
    goalLabel: config.label,
    goalSetAt: profile.goalSetAt,
    guidanceForAI: config.guidance + (incomeTransitionContext ? `\n\n${incomeTransitionContext}` : ''),
    goalTarget: gt?.description ? {
      description: gt.description,
      monthlyNeeded: gt.monthlyNeeded,
      targetValue: gt.targetValue,
      metric: gt.metric,
    } : null,
    incomeTransitionContext,
  }
}
