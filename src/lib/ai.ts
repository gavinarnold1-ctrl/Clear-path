import Anthropic from '@anthropic-ai/sdk'
import type { TransactionSummary, AIInsightResponse } from '@/types/insights'
import type { TemporalContext, SpendingVelocity } from './temporal-context'
import type { BudgetContext } from './budget-context'
import type { InsightHistory } from './insight-history'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export interface InsightGenerationContext {
  summary: TransactionSummary
  temporal?: TemporalContext
  velocity?: SpendingVelocity
  budget?: BudgetContext
  history?: InsightHistory
}

function sanitizeForPrompt(value: string): string {
  return value.replace(/[\n\r]/g, ' ').replace(/[\\`]/g, '').slice(0, 200)
}

export async function generateInsights(ctx: InsightGenerationContext): Promise<AIInsightResponse> {
  const { summary, temporal, velocity, budget, history } = ctx

  const systemPrompt = `You are a personal finance analyst inside a budgeting app called Clear-path. Your job is to analyze a user's spending data and generate specific, actionable recommendations that save them money.

RULES:
- Every recommendation MUST include a specific dollar amount (monthly or annual savings)
- Be direct and specific — "Switch from Starbucks 5x/week to 3x/week" not "Consider reducing coffee spending"
- Prioritize by dollar impact — biggest savings opportunities first
- Identify patterns the user might not notice (subscription creep, lifestyle inflation, timing patterns)
- Compare against benchmarks when available — "Your dining spend is 55% above median for your area"
- Never be judgmental about spending choices — frame as optimization opportunities
- Include at least one "quick win" that takes less than 10 minutes to implement
- Flag any potential tax-relevant spending you notice

TEMPORAL AWARENESS:
- Factor in the current time of month (start vs end), season, and upcoming holidays
- If it's end of month, focus on "stretch the remaining budget" advice
- If it's start of month, focus on planning and setting up for the month
- Reference seasonal patterns (heating bills in winter, travel in summer, holiday spending)
- If upcoming holidays are near, proactively advise on budget allocation

BUDGET AWARENESS:
- Reference specific budget categories that are over or under budget
- Call out unbudgeted spending as a concrete opportunity
- For fixed bills, note which are paid vs pending this month
- For annual expenses with low funding, flag as a priority

LEARNING FROM HISTORY:
- Do NOT repeat insight titles the user has already seen
- If the user frequently dismisses a category of advice, deprioritize it
- If "not_relevant" is a common dismiss reason, focus on more personalized advice
- If "already_doing" is common, look for more advanced/nuanced suggestions
- Weight toward categories/types the user has completed in the past

OUTPUT FORMAT:
Return valid JSON with this exact structure:
{
  "insights": [
    {
      "category": "spending|debt|savings|tax|subscription",
      "type": "waste|optimization|alert|opportunity",
      "priority": "high|medium|low",
      "title": "Short headline (max 60 chars)",
      "description": "2-3 sentence explanation with specific numbers",
      "savingsAmount": 150.00,
      "savingsFrequency": "monthly",
      "actionItems": ["Step 1", "Step 2", "Step 3"],
      "difficulty": "easy|moderate|hard"
    }
  ],
  "efficiencyScore": {
    "overall": 72,
    "spending": 68,
    "savings": 75,
    "debt": 80,
    "summary": "One sentence summary of overall financial efficiency"
  },
  "highlightStat": {
    "label": "Potential Annual Savings",
    "value": 3240,
    "context": "Based on 8 optimization opportunities identified"
  }
}`

  let userPrompt = `Analyze this spending data and generate financial insights:

PERIOD: ${summary.period.start} to ${summary.period.end} (${summary.period.months} months)

INCOME & SAVINGS:
- Total Income: $${summary.totalIncome.toFixed(2)}
- Total Expenses: $${summary.totalExpenses.toFixed(2)}
- Net Savings: $${summary.netSavings.toFixed(2)}
- Savings Rate: ${summary.savingsRate.toFixed(1)}%

SPENDING BY CATEGORY (with benchmarks where available):
${summary.categoryBreakdown
  .map((c) => {
    let line = `- ${sanitizeForPrompt(c.category)}: $${c.total.toFixed(2)} total ($${c.avgTransaction.toFixed(2)} avg, ${c.transactionCount} transactions)`
    if (c.benchmark) {
      line += ` | Benchmark median: $${c.benchmark.median}/mo, Rating: ${c.benchmark.rating}`
    }
    return line
  })
  .join('\n')}

TOP MERCHANTS:
${summary.topMerchants.map((m) => `- ${sanitizeForPrompt(m.name)}: $${m.total.toFixed(2)} (${m.count}x) [${sanitizeForPrompt(m.category)}]`).join('\n')}

RECURRING/SUBSCRIPTION CHARGES DETECTED:
${summary.recurringCharges.map((r) => `- ${sanitizeForPrompt(r.description)}: $${r.amount.toFixed(2)} (${sanitizeForPrompt(r.frequency)})`).join('\n')}

MONTH-OVER-MONTH CHANGES:
${summary.monthOverMonthChange
  .map(
    (m) =>
      `- ${sanitizeForPrompt(m.category)}: $${m.previousMonth.toFixed(2)} → $${m.currentMonth.toFixed(2)} (${m.changePercent > 0 ? '+' : ''}${m.changePercent.toFixed(1)}%)`
  )
  .join('\n')}`

  if (temporal) {
    userPrompt += `

TEMPORAL CONTEXT:
- Current date: ${temporal.currentMonth} ${temporal.dayOfMonth}, ${temporal.currentYear}
- Days left in month: ${temporal.daysLeftInMonth}
- Position: ${temporal.isStartOfMonth ? 'Start of month' : temporal.isEndOfMonth ? 'End of month' : `Week ${temporal.weekOfMonth}`}
- Payday proximity: ${temporal.isPaydayWeek ? 'Near a typical payday' : 'Mid-pay period'}
- Season: ${temporal.season}${temporal.upcomingHolidays.length > 0 ? `\n- Upcoming holidays: ${temporal.upcomingHolidays.join(', ')}` : ''}`
  }

  if (velocity) {
    userPrompt += `

SPENDING VELOCITY:
- Daily average this month: $${velocity.dailyAverage.toFixed(2)}/day
- Projected month total: $${velocity.projectedMonthTotal.toFixed(2)}
- Compared to last month: ${velocity.comparedToLastMonth > 0 ? '+' : ''}${velocity.comparedToLastMonth.toFixed(1)}%`
  }

  if (budget) {
    userPrompt += `

BUDGET STATUS:
- Total budgeted: $${budget.totalBudgeted.toFixed(2)} | Spent: $${budget.totalSpent.toFixed(2)} (${budget.utilizationPercent}%)
- Unbudgeted spending this month: $${budget.unbudgetedSpending.toFixed(2)}`

    if (budget.overBudgetCategories.length > 0) {
      userPrompt += `\n- Over budget: ${budget.overBudgetCategories.map((c) => `${sanitizeForPrompt(c.name)} ($${c.overBy.toFixed(2)} over)`).join(', ')}`
    }
    if (budget.underUtilizedCategories.length > 0) {
      userPrompt += `\n- Under-utilized: ${budget.underUtilizedCategories.map((c) => `${sanitizeForPrompt(c.name)} (${c.pctUsed}% used)`).join(', ')}`
    }
    if (budget.fixedBills.length > 0) {
      const unpaid = budget.fixedBills.filter((b) => !b.isPaid)
      if (unpaid.length > 0) {
        userPrompt += `\n- Pending fixed bills: ${unpaid.map((b) => `${sanitizeForPrompt(b.name)} ($${b.amount.toFixed(2)})`).join(', ')}`
      }
    }
    if (budget.annualExpenses.length > 0) {
      const underfunded = budget.annualExpenses.filter((a) => a.funded < a.annualAmount * 0.5 && a.monthsLeft <= 3)
      if (underfunded.length > 0) {
        userPrompt += `\n- Underfunded annual expenses: ${underfunded.map((a) => `${sanitizeForPrompt(a.name)} (${Math.round((a.funded / a.annualAmount) * 100)}% funded, ${a.monthsLeft}mo left)`).join(', ')}`
      }
    }
  }

  if (history) {
    userPrompt += `

USER HISTORY:
- Insights generated: ${history.totalGenerated} | Completed: ${history.completed} (${history.completionRate}%) | Dismissed: ${history.dismissed}`

    if (history.topDismissReasons.length > 0) {
      userPrompt += `\n- Top dismiss reasons: ${history.topDismissReasons.map((r) => `"${r.reason}" (${r.count}x)`).join(', ')}`
    }
    if (history.previousInsightTitles.length > 0) {
      userPrompt += `\n- DO NOT repeat these titles: ${history.previousInsightTitles.slice(0, 15).join(' | ')}`
    }
  }

  userPrompt += '\n\nGenerate 5-8 specific, actionable insights prioritized by dollar impact.'

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    messages: [{ role: 'user', content: userPrompt }],
    system: systemPrompt,
  })

  if (response.stop_reason !== 'end_turn') {
    throw new Error(`AI response was truncated (stop_reason: ${response.stop_reason})`)
  }

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')

  // Parse JSON from response (handle markdown code fences)
  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
  return JSON.parse(cleaned) as AIInsightResponse
}
