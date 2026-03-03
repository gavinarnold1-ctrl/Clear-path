import { db } from './db'

export interface GoalContext {
  primaryGoal: string
  goalLabel: string
  goalSetAt: Date | null
  guidanceForAI: string
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
    select: { primaryGoal: true, goalSetAt: true },
  })

  if (!profile?.primaryGoal) return null

  const config = GOAL_GUIDANCE[profile.primaryGoal]
  if (!config) return null

  return {
    primaryGoal: profile.primaryGoal,
    goalLabel: config.label,
    goalSetAt: profile.goalSetAt,
    guidanceForAI: config.guidance,
  }
}
