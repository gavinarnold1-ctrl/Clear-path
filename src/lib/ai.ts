import Anthropic from '@anthropic-ai/sdk'
import type { TransactionSummary, AIInsightResponse } from '@/types/insights'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function generateInsights(summary: TransactionSummary): Promise<AIInsightResponse> {
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

  const userPrompt = `Analyze this spending data and generate financial insights:

PERIOD: ${summary.period.start} to ${summary.period.end} (${summary.period.months} months)

INCOME & SAVINGS:
- Total Income: $${summary.totalIncome.toFixed(2)}
- Total Expenses: $${summary.totalExpenses.toFixed(2)}
- Net Savings: $${summary.netSavings.toFixed(2)}
- Savings Rate: ${summary.savingsRate.toFixed(1)}%

SPENDING BY CATEGORY (with benchmarks where available):
${summary.categoryBreakdown
  .map((c) => {
    let line = `- ${c.category}: $${c.total.toFixed(2)} total ($${c.avgTransaction.toFixed(2)} avg, ${c.transactionCount} transactions)`
    if (c.benchmark) {
      line += ` | Benchmark median: $${c.benchmark.median}/mo, Rating: ${c.benchmark.rating}`
    }
    return line
  })
  .join('\n')}

TOP MERCHANTS:
${summary.topMerchants.map((m) => `- ${m.name}: $${m.total.toFixed(2)} (${m.count}x) [${m.category}]`).join('\n')}

RECURRING/SUBSCRIPTION CHARGES DETECTED:
${summary.recurringCharges.map((r) => `- ${r.description}: $${r.amount.toFixed(2)} (${r.frequency})`).join('\n')}

MONTH-OVER-MONTH CHANGES:
${summary.monthOverMonthChange
  .map(
    (m) =>
      `- ${m.category}: $${m.previousMonth.toFixed(2)} → $${m.currentMonth.toFixed(2)} (${m.changePercent > 0 ? '+' : ''}${m.changePercent.toFixed(1)}%)`
  )
  .join('\n')}

Generate 5-8 specific, actionable insights prioritized by dollar impact.`

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
