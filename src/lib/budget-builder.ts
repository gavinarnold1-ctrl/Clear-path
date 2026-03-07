import Anthropic from '@anthropic-ai/sdk'
import { db } from './db'
import { buildTemporalContext } from './temporal-context'
import type { GoalContext } from './goal-context'
import { OVERSIKT_VOICE } from './ai-voice'

// ─── Spending Profile ───────────────────────────────────────────────────────

export interface SpendingProfile {
  incomeStreams: {
    source: string
    frequency: string
    averageAmount: number
    count: number
    dayOfMonth?: number
  }[]
  totalMonthlyIncome: number
  detectedFixed: {
    merchant: string
    category: string
    amount: number
    frequency: string
    dayOfMonth: number
    months: number[]
    isAutoPay: boolean
    confidence: number
  }[]
  variableByCategory: {
    category: string
    group: string
    monthlyAverage: number
    monthlyMedian: number
    min: number
    max: number
    months: number
    trend: 'increasing' | 'decreasing' | 'stable'
    transactionCount: number
  }[]
  detectedAnnual: {
    merchant: string
    category: string
    amount: number
    date: Date
    description: string
    isPast: boolean
  }[]
  monthsOfData: number
  totalTransactions: number
  averageMonthlyExpenses: number
  averageMonthlySavings: number
  savingsRate: number
}

export async function analyzeSpendingProfile(userId: string): Promise<SpendingProfile> {
  const transactions = await db.transaction.findMany({
    where: { userId },
    include: { category: true },
    orderBy: { date: 'asc' },
  })

  if (transactions.length === 0) {
    throw new Error('No transactions found. Import transactions first.')
  }

  const dates = transactions.map((t) => t.date)
  const earliest = new Date(Math.min(...dates.map((d) => d.getTime())))
  const latest = new Date(Math.max(...dates.map((d) => d.getTime())))
  const monthsOfData = Math.max(
    1,
    (latest.getFullYear() - earliest.getFullYear()) * 12 +
      (latest.getMonth() - earliest.getMonth()) +
      1
  )

  // ── Temporal cutoffs ──
  const now = new Date()
  const threeMonthsAgo = new Date(now)
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  const sixMonthsAgo = new Date(now)
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const twelveMonthsAgo = new Date(now)
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

  // Income: last 3 months only
  const recentIncome = transactions.filter(
    (t) => t.classification === 'income' && t.date >= threeMonthsAgo
  )
  // Fixed/variable expenses: last 6 months only
  const recentExpenses = transactions.filter(
    (t) => t.classification === 'expense' && t.date >= sixMonthsAgo
  )
  // Annual detection: last 12 months
  const annualCandidates = transactions.filter(
    (t) => t.classification === 'expense' && t.date >= twelveMonthsAgo
  )

  // ── Income Streams (last 3 months) ──
  const incomeByMerchant = new Map<string, { amounts: number[]; dates: Date[] }>()
  recentIncome.forEach((t) => {
    const key = t.merchant || 'Unknown'
    const existing = incomeByMerchant.get(key) || { amounts: [], dates: [] }
    existing.amounts.push(Math.abs(t.amount))
    existing.dates.push(t.date)
    incomeByMerchant.set(key, existing)
  })

  const incomeStreams = Array.from(incomeByMerchant.entries()).map(([source, data]) => {
    const avg = data.amounts.reduce((a, b) => a + b, 0) / data.amounts.length
    const frequency = detectFrequency(data.dates)
    const dayOfMonth =
      frequency === 'monthly'
        ? Math.round(data.dates.reduce((s, d) => s + d.getDate(), 0) / data.dates.length)
        : undefined

    return { source, frequency, averageAmount: avg, count: data.amounts.length, dayOfMonth }
  })

  // Only count predictable recurring income in the monthly total.
  // Irregular income is listed separately in the prompt as context.
  const totalMonthlyIncome = incomeStreams.reduce((sum, s) => {
    if (s.frequency === 'biweekly') {
      const annualized = (s.averageAmount * 26) / 12
      const actualMonthly = (s.averageAmount * s.count) / 3
      return sum + Math.min(annualized, actualMonthly * 1.1) // 10% tolerance for 3-paycheck months
    }
    if (s.frequency === 'weekly') return sum + (s.averageAmount * 52) / 12
    if (s.frequency === 'monthly') return sum + s.averageAmount
    // Irregular income: do NOT add to monthly total
    return sum
  }, 0)

  // ── Fixed Expense Detection (last 6 months, min 3 occurrences) ──
  const expenseByKey = new Map<
    string,
    { amounts: number[]; dates: Date[]; category: string }
  >()
  recentExpenses.forEach((t) => {
    const merchant = t.merchant || t.originalStatement || 'Unknown'
    const amount = Math.abs(t.amount)
    const roundedAmount = Math.round(amount / 5) * 5
    const key = `${merchant}__${roundedAmount}`

    const existing = expenseByKey.get(key) || { amounts: [], dates: [], category: '' }
    existing.amounts.push(amount)
    existing.dates.push(t.date)
    existing.category = t.category?.name ?? 'Uncategorized'
    expenseByKey.set(key, existing)
  })

  const detectedFixed: SpendingProfile['detectedFixed'] = []
  expenseByKey.forEach((data, key) => {
    const merchant = key.split('__')[0]
    if (data.amounts.length < 3) return

    const avg = data.amounts.reduce((a, b) => a + b, 0) / data.amounts.length
    const isConsistent = data.amounts.every((a) => Math.abs(a - avg) / avg < 0.1)
    if (!isConsistent) return

    const frequency = detectFrequency(data.dates)
    if (frequency === 'irregular') return

    const avgDay = Math.round(
      data.dates.reduce((s, d) => s + d.getDate(), 0) / data.dates.length
    )
    const months = [...new Set(data.dates.map((d) => d.getMonth() + 1))]
    const confidence = Math.min(1, (data.amounts.length / 6) * (isConsistent ? 1 : 0.5))

    detectedFixed.push({
      merchant,
      category: data.category,
      amount: Math.round(avg * 100) / 100,
      frequency,
      dayOfMonth: avgDay,
      months,
      isAutoPay: confidence > 0.8,
      confidence,
    })
  })

  // ── Variable Spending by Category (last 6 months) ──
  const expenseByCategory = new Map<
    string,
    { amounts: number[]; dates: Date[]; group: string }
  >()
  recentExpenses.forEach((t) => {
    const catName = t.category?.name ?? 'Uncategorized'
    const group = t.category?.group ?? 'Other'
    const merchant = t.merchant || t.originalStatement || 'Unknown'
    const amount = Math.abs(t.amount)
    const isFixed = detectedFixed.some(
      (f) => f.merchant === merchant && Math.abs(f.amount - amount) / f.amount < 0.1
    )
    if (isFixed) return

    const existing = expenseByCategory.get(catName) || { amounts: [], dates: [], group }
    existing.amounts.push(amount)
    existing.dates.push(t.date)
    expenseByCategory.set(catName, existing)
  })

  const variableByCategory = Array.from(expenseByCategory.entries())
    .map(([category, data]) => {
      const byMonth = new Map<string, number>()
      data.dates.forEach((d, i) => {
        const k = `${d.getFullYear()}-${d.getMonth()}`
        byMonth.set(k, (byMonth.get(k) || 0) + data.amounts[i])
      })
      const monthlyTotals = Array.from(byMonth.values())
      const avg = monthlyTotals.reduce((a, b) => a + b, 0) / monthlyTotals.length
      const sorted = [...monthlyTotals].sort((a, b) => a - b)
      const median = sorted[Math.floor(sorted.length / 2)] ?? avg

      const halfIdx = Math.floor(monthlyTotals.length / 2)
      const firstHalf = monthlyTotals.slice(0, halfIdx)
      const secondHalf = monthlyTotals.slice(halfIdx)
      const firstAvg =
        firstHalf.length > 0 ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length : 0
      const secondAvg =
        secondHalf.length > 0 ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : 0
      const trend: 'increasing' | 'decreasing' | 'stable' =
        secondAvg > firstAvg * 1.1
          ? 'increasing'
          : secondAvg < firstAvg * 0.9
            ? 'decreasing'
            : 'stable'

      return {
        category,
        group: data.group,
        monthlyAverage: Math.round(avg * 100) / 100,
        monthlyMedian: Math.round(median * 100) / 100,
        min: Math.round(Math.min(...monthlyTotals) * 100) / 100,
        max: Math.round(Math.max(...monthlyTotals) * 100) / 100,
        months: monthlyTotals.length,
        trend,
        transactionCount: data.amounts.length,
      }
    })
    .filter((c) => c.monthlyAverage > 5)
    .sort((a, b) => b.monthlyAverage - a.monthlyAverage)

  // ── Large Infrequent Charges (last 12 months) ──
  const detectedAnnual = annualCandidates
    .filter((t) => {
      const amount = Math.abs(t.amount)
      const merchant = t.merchant || 'Unknown'
      const isFixed = detectedFixed.some((f) => f.merchant === merchant)
      return amount > 200 && !isFixed
    })
    .map((t) => ({
      merchant: t.merchant || 'Unknown',
      category: t.category?.name ?? 'Uncategorized',
      amount: Math.abs(t.amount),
      date: t.date,
      description: t.originalStatement || t.merchant || '',
      isPast: t.date < now,
    }))

  const averageMonthlyExpenses =
    recentExpenses.reduce((s, t) => s + Math.abs(t.amount), 0) / 6

  return {
    incomeStreams,
    totalMonthlyIncome,
    detectedFixed: detectedFixed.sort((a, b) => b.amount - a.amount),
    variableByCategory,
    detectedAnnual,
    monthsOfData,
    totalTransactions: transactions.length,
    averageMonthlyExpenses: Math.round(averageMonthlyExpenses * 100) / 100,
    averageMonthlySavings: Math.round((totalMonthlyIncome - averageMonthlyExpenses) * 100) / 100,
    savingsRate:
      totalMonthlyIncome > 0
        ? Math.round(
            ((totalMonthlyIncome - averageMonthlyExpenses) / totalMonthlyIncome) * 100 * 10
          ) / 10
        : 0,
  }
}

function detectFrequency(dates: Date[]): string {
  if (dates.length < 2) return 'irregular'

  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime())
  const gaps: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    gaps.push((sorted[i].getTime() - sorted[i - 1].getTime()) / 86400000)
  }

  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length

  if (avgGap >= 25 && avgGap <= 35) return 'monthly'
  if (avgGap >= 12 && avgGap <= 16) return 'biweekly'
  if (avgGap >= 5 && avgGap <= 9) return 'weekly'
  if (avgGap >= 85 && avgGap <= 95) return 'quarterly'
  if (avgGap >= 350 && avgGap <= 380) return 'annual'
  return 'irregular'
}

// ─── AI Budget Proposal ─────────────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export interface BudgetProposal {
  fixed: {
    name: string
    category: string
    amount: number
    dueDay: number
    isAutoPay: boolean
    confidence: number
    reasoning: string
  }[]
  flexible: {
    name: string
    category: string
    amount: number
    reasoning: string
  }[]
  annual: {
    name: string
    category: string
    annualAmount: number
    dueMonth: number
    isRecurring: boolean
    reasoning: string
  }[]
  summary: {
    totalFixed: number
    totalFlexible: number
    totalAnnualMonthly: number
    projectedTrueRemaining: number
    savingsRate: number
    commentary: string
  }
}

export interface BenchmarkData {
  category: string
  appCategory: string | null
  monthlyMean: number
  annualMedian: number | null
  shareOfTotal: number | null
}

export async function generateBudgetProposal(
  profile: SpendingProfile,
  goalContext?: GoalContext | null,
  benchmarks?: BenchmarkData[] | null
): Promise<BudgetProposal> {
  const temporalContext = buildTemporalContext()

  const systemPrompt = `${OVERSIKT_VOICE}
You are a personal finance expert building a budget for a user of Oversikt, a budgeting app. You have their actual spending data and need to propose a complete budget structure.

Oversikt uses THREE budget tiers:

1. FIXED — Recurring bills with predictable amounts. Same amount every month (or quarter/year). Examples: mortgage, rent, insurance, phone bill, internet, subscriptions, loan payments. These are commitments — the money is spoken for.

2. FLEXIBLE — Variable spending the user controls. Changes month to month based on behavior. Examples: groceries, dining out, gas, shopping, entertainment, coffee. Budget amounts should be realistic targets — not aspirational, not just average.

3. ANNUAL — Large infrequent expenses the user should save for via sinking funds. Examples: vacation, property tax (if paid as lump), holiday gifts, home repairs, car maintenance, annual insurance premiums, tuition. These get a monthly set-aside amount.

YOUR JOB:
Analyze the spending profile and propose a complete budget. Be specific and realistic.

RULES:
- Fixed amounts should match actual detected recurring charges. Don't round aggressively — if they pay $79.99, budget $79.99.
- Flexible amounts should be BETWEEN the user's median and average monthly spend. Not the minimum (unrealistic), not the max (no improvement). If spending is above benchmarks, suggest a moderate reduction — not a dramatic cut.
- Annual items: include anything that's clearly a large irregular expense. Also SUGGEST common annual expenses the user probably has even if not in the data (property tax, car registration, dentist, etc.) — mark these as "suggested" with lower confidence.
- Do NOT include transfers or credit card payments as budget items.
- Each item needs a SHORT "reasoning" (max 50 characters) explaining the amount.
- ONLY propose budget items for expenses that are ACTIVE — meaning they have transactions in the last 6 months. Do not budget for historical expenses that have stopped. If a recurring charge has not appeared in 3+ months, exclude it or flag it as "possibly inactive."
- Income should reflect CURRENT monthly income, not historical averages that include one-time windfalls.
- Large infrequent charges are HISTORICAL DATA showing what the user actually spent. Charges dated in the past are COMPLETED expenses — do NOT assume they will recur unless there's a clear annual pattern (e.g., property tax appearing at the same time each year). One-time life events (weddings, moves, medical procedures) should be noted in the commentary as past events, not budgeted as future expenses.
- When suggesting annual expenses, base suggestions on RECURRING patterns (same charge appearing ~12 months apart) or common household expenses. Do NOT extrapolate one-time events into future budget items.
- The "Total predictable monthly income" figure provided is ONLY from predictable recurring sources (paychecks, regular salary). Do NOT inflate this number. If irregular income is listed separately, mention it in commentary as a bonus but do NOT add it to the base income for budget math. The budget must balance against predictable income only.
- The summary should show projected True Remaining and note if the budget is tight, comfortable, or has room for more savings.

TEMPORAL CONTEXT:
Current date: ${temporalContext.currentMonth} ${temporalContext.dayOfMonth}, ${temporalContext.currentYear}
For annual items, set due months that make sense (property tax: varies by state, insurance: typically renewal month, vacation: summer, gifts: December).
${
  benchmarks && benchmarks.length > 0
    ? `
BLS BENCHMARK DATA (Consumer Expenditure Survey for this income bracket):
${benchmarks
  .filter((b) => b.appCategory)
  .map(
    (b) =>
      `- ${b.appCategory}: $${b.monthlyMean.toFixed(0)}/mo average${b.annualMedian ? ` (median $${(b.annualMedian / 12).toFixed(0)}/mo)` : ''}`
  )
  .join('\n')}

When proposing flexible budget amounts, compare the user's actual spending to these benchmarks. If the user spends significantly above the benchmark median, note this in the reasoning and suggest a target closer to the benchmark — but never below the user's minimum observed spend. If below benchmark, acknowledge they're already efficient in that category.`
    : ''
}

OUTPUT FORMAT — Return ONLY valid JSON with no markdown, no commentary, no text before or after the JSON object:
{
  "fixed": [
    {
      "name": "Mortgage",
      "category": "Housing",
      "amount": 1847.00,
      "dueDay": 1,
      "isAutoPay": true,
      "confidence": 0.95,
      "reasoning": "Detected monthly charge of $1,847.00 from lender, consistent across all months"
    }
  ],
  "flexible": [
    {
      "name": "Groceries",
      "category": "Food & Dining",
      "amount": 450,
      "reasoning": "Average spend $487/mo, median $462. Setting at $450 — slight reduction without being unrealistic."
    }
  ],
  "annual": [
    {
      "name": "Property Tax",
      "category": "Housing",
      "annualAmount": 4992,
      "dueMonth": 7,
      "isRecurring": true,
      "reasoning": "Detected $2,496 charge in Jan — likely semi-annual. Annualized to $4,992."
    }
  ],
  "summary": {
    "totalFixed": 3547,
    "totalFlexible": 1310,
    "totalAnnualMonthly": 425,
    "projectedTrueRemaining": 1209,
    "savingsRate": 18.6,
    "commentary": "Budget is balanced with an 18.6% savings rate..."
  }
}`

  // Cap data to keep prompt size manageable
  const topFixed = profile.detectedFixed.slice(0, 15)
  const topVariable = profile.variableByCategory.slice(0, 15)
  const topAnnual = profile.detectedAnnual.slice(0, 10)

  const regularIncome = profile.incomeStreams.filter(s => ['monthly', 'biweekly', 'weekly'].includes(s.frequency))
  const irregularIncome = profile.incomeStreams.filter(s => !['monthly', 'biweekly', 'weekly'].includes(s.frequency))

  let userPrompt = `Build a complete budget proposal based on this spending profile:

REGULAR INCOME:
${regularIncome.map((s) => `- ${s.source}: $${s.averageAmount.toFixed(2)} (${s.frequency}, ${s.count} occurrences${s.dayOfMonth ? `, ~day ${s.dayOfMonth}` : ''})`).join('\n') || 'None detected'}
Total predictable monthly income: $${profile.totalMonthlyIncome.toFixed(2)}

IRREGULAR/ONE-TIME INCOME (last 3 months):
${irregularIncome.length > 0
    ? irregularIncome.map(s => `- ${s.source}: $${s.averageAmount.toFixed(2)} × ${s.count} (${s.frequency} — do NOT include in base budget)`).join('\n')
    : 'None detected'}

DETECTED FIXED EXPENSES (${topFixed.length} of ${profile.detectedFixed.length} items):
${topFixed.map((f) => `- ${f.merchant}: $${f.amount.toFixed(2)} (${f.frequency}, day ~${f.dayOfMonth}, ${f.category}, confidence: ${(f.confidence * 100).toFixed(0)}%${f.isAutoPay ? ', autopay likely' : ''})`).join('\n')}

VARIABLE SPENDING BY CATEGORY:
${topVariable.map((c) => {
    const bm = benchmarks?.find(
      (b) =>
        b.appCategory &&
        (b.appCategory.toLowerCase() === c.category.toLowerCase() ||
          b.category.toLowerCase().includes(c.category.toLowerCase()) ||
          c.category.toLowerCase().includes((b.appCategory ?? '').toLowerCase()))
    )
    const bmNote = bm ? ` [BLS benchmark: $${bm.monthlyMean.toFixed(0)}/mo]` : ''
    return `- ${c.category} (${c.group}): avg $${c.monthlyAverage.toFixed(2)}/mo, median $${c.monthlyMedian.toFixed(2)}, range $${c.min.toFixed(0)}-$${c.max.toFixed(0)}, trend: ${c.trend}, ${c.transactionCount} transactions over ${c.months} months${bmNote}`
  }).join('\n')}

LARGE INFREQUENT CHARGES (historical — these already happened):
${
  topAnnual.length > 0
    ? topAnnual
        .map(
          (a) =>
            `- ${a.merchant}: $${a.amount.toFixed(2)} on ${a.date.toLocaleDateString()} [${a.isPast ? 'PAST — completed' : 'UPCOMING'}] (${a.category}) — "${a.description}"`
        )
        .join('\n')
    : 'None detected in data (limited history). Suggest common annual expenses.'
}
${topAnnual.length > 0 ? '\nNOTE: The above charges are historical. Only budget for them if they show a clear annual recurrence pattern. One-time events (weddings, moves, large purchases) should NOT be projected forward.' : ''}

DATA COVERAGE: Income based on last 3 months. Fixed/variable based on last 6 months. Annual detection based on last 12 months. Total history: ${profile.monthsOfData} months, ${profile.totalTransactions} transactions.
CURRENT SAVINGS RATE: ${profile.savingsRate}%`

  if (goalContext) {
    userPrompt += `

USER'S PRIMARY FINANCIAL GOAL: ${goalContext.goalLabel}
${goalContext.guidanceForAI}
Tailor the budget structure and commentary to serve this goal.`

    if (goalContext.goalTarget?.description) {
      const gt = goalContext.goalTarget
      userPrompt += `
Goal target: ${gt.description}
${gt.monthlyNeeded ? `Monthly contribution needed: $${gt.monthlyNeeded.toFixed(0)}` : ''}
${gt.targetValue ? `Target value: $${gt.targetValue.toLocaleString()}` : ''}

ARCHETYPE-SPECIFIC BUDGET INSTRUCTIONS:`
      if (goalContext.primaryGoal === 'save_more') {
        userPrompt += `\n- Be more aggressive with flexible spending targets. Ensure projected surplus >= $${(gt.monthlyNeeded ?? 0).toFixed(0)}/mo for savings.`
      } else if (goalContext.primaryGoal === 'pay_off_debt') {
        userPrompt += `\n- Minimize flexible spending where possible. Frame surplus as "available for extra debt payments." Ensure projected surplus >= $${(gt.monthlyNeeded ?? 0).toFixed(0)}/mo.`
      } else if (goalContext.primaryGoal === 'spend_smarter') {
        userPrompt += `\n- Focus on getting best value from each budget category. Compare to benchmarks aggressively. Highlight categories where the user is over benchmark.`
      } else if (goalContext.primaryGoal === 'gain_visibility') {
        userPrompt += `\n- Ensure every major spending category has a budget. Completeness matters more than aggressiveness.`
      } else if (goalContext.primaryGoal === 'build_wealth') {
        userPrompt += `\n- Maximize surplus for investing. Be aggressive on flexible cuts. Frame commentary around wealth-building timeline impact.`
      }
    }
  }

  userPrompt += `

Propose a realistic, complete budget using all three tiers (Fixed, Flexible, Annual). For categories with limited data, use your judgment and mark with lower confidence. Include 2-3 suggested annual expenses even if not in the data — common ones most households have.`

  // Retry up to 3 attempts for transient API errors (overloaded, rate limit)
  // and non-JSON responses
  let lastError: Error | null = null
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 2s, 4s
      await new Promise((r) => setTimeout(r, 2000 * Math.pow(2, attempt - 1)))
    }

    let response
    try {
      response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt },
          // Prefill forces the model to continue with JSON instead of markdown/text
          { role: 'assistant', content: '{' },
        ],
      })
    } catch (apiError: unknown) {
      lastError = apiError instanceof Error ? apiError : new Error(String(apiError))
      // Retry on overloaded/rate-limit/server errors
      const status = (apiError as { status?: number })?.status
      if (status === 529 || status === 429 || status === 500 || status === 503) {
        continue
      }
      throw apiError
    }

    // Prepend the '{' from our prefill since it's not included in the response
    const responseText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')
    const text = '{' + responseText

    const cleaned = repairJSON(text)

    try {
      return JSON.parse(cleaned) as BudgetProposal
    } catch (parseError) {
      lastError = parseError as Error
      // First attempt failed — retry once
      continue
    }
  }

  throw new Error(
    `Failed to generate AI budget after 3 attempts: ${lastError?.message}`
  )
}

/**
 * Repair common LLM JSON issues:
 * - Markdown fences
 * - Trailing commas
 * - Single-line comments
 * - Single-quoted keys
 * - Unescaped double quotes inside string values
 * - Newlines inside strings
 * - Control characters
 */
function repairJSON(raw: string): string {
  // Strip markdown fences
  let s = raw.replace(/```json\n?|\n?```/g, '').trim()

  // Extract just the JSON object
  const jsonStart = s.indexOf('{')
  const jsonEnd = s.lastIndexOf('}')
  if (jsonStart !== -1 && jsonEnd !== -1) {
    s = s.slice(jsonStart, jsonEnd + 1)
  }

  // Remove single-line // comments
  s = s.replace(/\/\/[^\n]*$/gm, '')
  // Remove trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, '$1')
  // Single-quoted keys → double-quoted
  s = s.replace(/'([^']+)'\s*:/g, '"$1":')
  // Strip control characters except tab/newline/carriage-return
  s = s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')

  // Fix unescaped double quotes inside string values.
  // Walk character by character to find strings and escape inner quotes.
  const result: string[] = []
  let i = 0
  while (i < s.length) {
    if (s[i] === '"') {
      // Start of a JSON string — find the real end
      result.push('"')
      i++
      while (i < s.length) {
        if (s[i] === '\\') {
          // Escaped character — keep both
          result.push(s[i], s[i + 1] ?? '')
          i += 2
          continue
        }
        if (s[i] === '"') {
          // Is this the closing quote or an unescaped inner quote?
          // Closing quote is followed by :, ,, }, ], or whitespace then one of those
          const rest = s.slice(i + 1).trimStart()
          if (
            rest.length === 0 ||
            rest[0] === ':' ||
            rest[0] === ',' ||
            rest[0] === '}' ||
            rest[0] === ']'
          ) {
            result.push('"')
            i++
            break
          } else {
            // Unescaped inner quote — escape it
            result.push('\\"')
            i++
            continue
          }
        }
        if (s[i] === '\n') {
          result.push('\\n')
          i++
          continue
        }
        if (s[i] === '\r') {
          i++
          continue
        }
        result.push(s[i])
        i++
      }
    } else {
      result.push(s[i])
      i++
    }
  }

  return result.join('')
}
