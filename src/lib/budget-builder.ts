import Anthropic from '@anthropic-ai/sdk'
import { db } from './db'
import { buildTemporalContext } from './temporal-context'

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

  const income = transactions.filter(
    (t) => t.category?.type === 'income' || (!t.category && t.amount > 0)
  )
  const expenses = transactions.filter(
    (t) => t.category?.type === 'expense' || (!t.category && t.amount < 0)
  )

  // ── Income Streams ──
  const incomeByMerchant = new Map<string, { amounts: number[]; dates: Date[] }>()
  income.forEach((t) => {
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

  const totalMonthlyIncome = incomeStreams.reduce((sum, s) => {
    if (s.frequency === 'biweekly') return sum + (s.averageAmount * 26) / 12
    if (s.frequency === 'weekly') return sum + (s.averageAmount * 52) / 12
    if (s.frequency === 'monthly') return sum + s.averageAmount
    return sum + (s.averageAmount * s.count) / monthsOfData
  }, 0)

  // ── Fixed Expense Detection ──
  const expenseByKey = new Map<
    string,
    { amounts: number[]; dates: Date[]; category: string }
  >()
  expenses.forEach((t) => {
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
    if (data.amounts.length < 2) return

    const avg = data.amounts.reduce((a, b) => a + b, 0) / data.amounts.length
    const isConsistent = data.amounts.every((a) => Math.abs(a - avg) / avg < 0.1)
    if (!isConsistent) return

    const frequency = detectFrequency(data.dates)
    if (frequency === 'irregular') return

    const avgDay = Math.round(
      data.dates.reduce((s, d) => s + d.getDate(), 0) / data.dates.length
    )
    const months = [...new Set(data.dates.map((d) => d.getMonth() + 1))]
    const confidence = Math.min(1, (data.amounts.length / monthsOfData) * (isConsistent ? 1 : 0.5))

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

  // ── Variable Spending by Category ──
  const expenseByCategory = new Map<
    string,
    { amounts: number[]; dates: Date[]; group: string }
  >()
  expenses.forEach((t) => {
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

  // ── Large Infrequent Charges ──
  const detectedAnnual = expenses
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
    }))

  const averageMonthlyExpenses =
    expenses.reduce((s, t) => s + Math.abs(t.amount), 0) / monthsOfData

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

export async function generateBudgetProposal(
  profile: SpendingProfile
): Promise<BudgetProposal> {
  const temporalContext = buildTemporalContext()

  const systemPrompt = `You are a personal finance expert building a budget for a user of Clear-path, a budgeting app. You have their actual spending data and need to propose a complete budget structure.

Clear-path uses THREE budget tiers:

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
- Each item needs a short "reasoning" explaining why you set this amount.
- The summary should show projected True Remaining and note if the budget is tight, comfortable, or has room for more savings.

TEMPORAL CONTEXT:
Current date: ${temporalContext.currentMonth} ${temporalContext.dayOfMonth}, ${temporalContext.currentYear}
For annual items, set due months that make sense (property tax: varies by state, insurance: typically renewal month, vacation: summer, gifts: December).

OUTPUT FORMAT — Return valid JSON:
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

  const userPrompt = `Build a complete budget proposal based on this spending profile:

INCOME:
${profile.incomeStreams.map((s) => `- ${s.source}: $${s.averageAmount.toFixed(2)} (${s.frequency}, ${s.count} occurrences${s.dayOfMonth ? `, ~day ${s.dayOfMonth}` : ''})`).join('\n')}
Total monthly income: $${profile.totalMonthlyIncome.toFixed(2)}

DETECTED FIXED EXPENSES (${profile.detectedFixed.length} items):
${profile.detectedFixed.map((f) => `- ${f.merchant}: $${f.amount.toFixed(2)} (${f.frequency}, day ~${f.dayOfMonth}, ${f.category}, confidence: ${(f.confidence * 100).toFixed(0)}%${f.isAutoPay ? ', autopay likely' : ''})`).join('\n')}

VARIABLE SPENDING BY CATEGORY:
${profile.variableByCategory.map((c) => `- ${c.category} (${c.group}): avg $${c.monthlyAverage.toFixed(2)}/mo, median $${c.monthlyMedian.toFixed(2)}, range $${c.min.toFixed(0)}-$${c.max.toFixed(0)}, trend: ${c.trend}, ${c.transactionCount} transactions over ${c.months} months`).join('\n')}

LARGE INFREQUENT CHARGES (potential annual expenses):
${
  profile.detectedAnnual.length > 0
    ? profile.detectedAnnual
        .map(
          (a) =>
            `- ${a.merchant}: $${a.amount.toFixed(2)} on ${a.date.toLocaleDateString()} (${a.category}) — "${a.description}"`
        )
        .join('\n')
    : 'None detected in data (limited history). Suggest common annual expenses.'
}

DATA COVERAGE: ${profile.monthsOfData} months, ${profile.totalTransactions} transactions
CURRENT SAVINGS RATE: ${profile.savingsRate}%

Propose a realistic, complete budget using all three tiers (Fixed, Flexible, Annual). For categories with limited data, use your judgment and mark with lower confidence. Include 2-3 suggested annual expenses even if not in the data — common ones most households have.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')

  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
  return JSON.parse(cleaned) as BudgetProposal
}
