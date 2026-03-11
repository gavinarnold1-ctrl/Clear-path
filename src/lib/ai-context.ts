import { db } from './db'

// ─── Signal Type Definitions ──────────────────────────────────────────────────

export interface CategorizationSignals {
  correctionCount: number
  topCorrectedMerchants: { merchant: string; from: string; to: string }[]
  categoryConfidence: Record<string, number>
  lastCorrectionAt: string | null
}

export interface InsightSignals {
  totalShown: number
  totalDismissed: number
  totalActedOn: number
  dismissedTypes: Record<string, number>
  engagedTypes: Record<string, number>
  recentDismissals: string[]
  recentEngagements: string[]
}

export interface BudgetSignals {
  generationCount: number
  adjustmentPatterns: {
    category: string
    suggestedAmount: number
    finalAmount: number
    direction: 'increased' | 'decreased'
  }[]
  preferredTierDistribution: {
    fixed: number; flexible: number; annual: number
  } | null
  rejectedCategories: string[]
  addedCategories: string[]
}

export interface SpendingProfile {
  monthsOfData: number
  avgMonthlyIncome: number
  avgMonthlyExpense: number
  volatileCategories: string[]
  stableCategories: string[]
  seasonalPatterns: { month: number; category: string; direction: 'spike' | 'dip' }[]
  trueRemainingTrend: 'improving' | 'stable' | 'declining'
  lastUpdated: string
}

export interface GoalSignals {
  recalibrationHistory: {
    date: string
    action: 'extend_date' | 'increase_monthly' | 'reduce_target' | 'celebrate'
    accepted: boolean
  }[]
  goalChanges: number
  paceStatus: 'ahead' | 'on_track' | 'behind' | null
}

// ─── Core CRUD ────────────────────────────────────────────────────────────────

export async function getOrCreateContext(userId: string) {
  return db.userAIContext.upsert({
    where: { userId },
    update: {},
    create: { userId },
  })
}

export async function updateContext(
  userId: string,
  data: Partial<{
    categorizationSignals: CategorizationSignals
    insightSignals: InsightSignals
    budgetSignals: BudgetSignals
    spendingProfile: SpendingProfile
    goalSignals: GoalSignals
  }>
) {
  // Serialize to plain JSON to satisfy Prisma's InputJsonValue constraint
  const serialized = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])
  )
  return db.userAIContext.upsert({
    where: { userId },
    update: serialized,
    create: { userId, ...serialized },
  })
}

// ─── Signal Capture Functions ─────────────────────────────────────────────────

export async function recordCategorizationCorrection(
  userId: string,
  merchant: string,
  fromCategory: string,
  toCategory: string
) {
  const ctx = await getOrCreateContext(userId)
  const signals = (ctx.categorizationSignals as unknown ?? {}) as CategorizationSignals

  signals.correctionCount = (signals.correctionCount || 0) + 1
  signals.lastCorrectionAt = new Date().toISOString()

  const corrections = signals.topCorrectedMerchants || []
  corrections.unshift({ merchant, from: fromCategory, to: toCategory })
  signals.topCorrectedMerchants = corrections.slice(0, 50)

  const conf = signals.categoryConfidence || {}
  conf[fromCategory] = Math.max(0, (conf[fromCategory] ?? 0.5) - 0.05)
  conf[toCategory] = Math.min(1, (conf[toCategory] ?? 0.5) + 0.02)
  signals.categoryConfidence = conf

  await updateContext(userId, { categorizationSignals: signals })
}

export async function recordInsightResponse(
  userId: string,
  insightType: string,
  insightSummary: string,
  action: 'dismissed' | 'acted_on'
) {
  const ctx = await getOrCreateContext(userId)
  const signals = (ctx.insightSignals as unknown ?? {}) as InsightSignals

  signals.totalShown = (signals.totalShown || 0) + 1

  if (action === 'dismissed') {
    signals.totalDismissed = (signals.totalDismissed || 0) + 1
    const dt = signals.dismissedTypes || {}
    dt[insightType] = (dt[insightType] || 0) + 1
    signals.dismissedTypes = dt
    const recent = signals.recentDismissals || []
    recent.unshift(insightSummary)
    signals.recentDismissals = recent.slice(0, 10)
  } else {
    signals.totalActedOn = (signals.totalActedOn || 0) + 1
    const et = signals.engagedTypes || {}
    et[insightType] = (et[insightType] || 0) + 1
    signals.engagedTypes = et
    const recent = signals.recentEngagements || []
    recent.unshift(insightSummary)
    signals.recentEngagements = recent.slice(0, 10)
  }

  await updateContext(userId, { insightSignals: signals })
}

interface BudgetItem {
  category: string
  amount: number
  tier: 'FIXED' | 'FLEXIBLE' | 'ANNUAL'
}

export async function recordBudgetAdjustments(
  userId: string,
  suggested: BudgetItem[],
  final: BudgetItem[]
) {
  const ctx = await getOrCreateContext(userId)
  const signals = (ctx.budgetSignals as unknown ?? {}) as BudgetSignals

  signals.generationCount = (signals.generationCount || 0) + 1

  const adjustments = signals.adjustmentPatterns || []
  for (const item of suggested) {
    const match = final.find(f => f.category === item.category)
    if (!match) {
      const rejected = signals.rejectedCategories || []
      if (!rejected.includes(item.category)) rejected.push(item.category)
      signals.rejectedCategories = rejected
    } else if (match.amount !== item.amount) {
      adjustments.unshift({
        category: item.category,
        suggestedAmount: item.amount,
        finalAmount: match.amount,
        direction: match.amount > item.amount ? 'increased' : 'decreased',
      })
    }
  }

  const added = signals.addedCategories || []
  for (const item of final) {
    if (!suggested.find(s => s.category === item.category)) {
      if (!added.includes(item.category)) added.push(item.category)
    }
  }
  signals.addedCategories = added
  signals.adjustmentPatterns = adjustments.slice(0, 20)

  const totalBudget = final.reduce((sum, f) => sum + Math.abs(f.amount), 0)
  if (totalBudget > 0) {
    signals.preferredTierDistribution = {
      fixed: final.filter(f => f.tier === 'FIXED').reduce((s, f) => s + Math.abs(f.amount), 0) / totalBudget,
      flexible: final.filter(f => f.tier === 'FLEXIBLE').reduce((s, f) => s + Math.abs(f.amount), 0) / totalBudget,
      annual: final.filter(f => f.tier === 'ANNUAL').reduce((s, f) => s + Math.abs(f.amount), 0) / totalBudget,
    }
  }

  await updateContext(userId, { budgetSignals: signals })
}

export async function recordRecalibrationResponse(
  userId: string,
  action: 'extend_date' | 'increase_monthly' | 'reduce_target' | 'celebrate',
  accepted: boolean
) {
  const ctx = await getOrCreateContext(userId)
  const signals = (ctx.goalSignals as unknown ?? {}) as GoalSignals

  const history = signals.recalibrationHistory || []
  history.unshift({ date: new Date().toISOString(), action, accepted })
  signals.recalibrationHistory = history.slice(0, 20)

  await updateContext(userId, { goalSignals: signals })
}

export async function updateGoalPaceStatus(
  userId: string,
  paceStatus: 'ahead' | 'on_track' | 'behind' | null
) {
  const ctx = await getOrCreateContext(userId)
  const signals = (ctx.goalSignals as unknown ?? {}) as GoalSignals
  signals.paceStatus = paceStatus
  await updateContext(userId, { goalSignals: signals })
}

// ─── Spending Profile Updater ─────────────────────────────────────────────────

export async function updateSpendingProfile(userId: string) {
  const snapshots = await db.monthlySnapshot.findMany({
    where: { userId },
    orderBy: { month: 'desc' },
    take: 12,
  })

  if (snapshots.length < 2) return

  const incomes = snapshots.map(s => (s.totalIncome as number | null) ?? 0)
  const expenses = snapshots.map(s => Math.abs((s.totalExpenses as number | null) ?? 0))
  const trueRemainingValues = snapshots.map(s => (s.trueRemaining as number | null) ?? 0)

  // Compute category volatility from transactions grouped by month
  const volatileCategories: string[] = []
  const stableCategories: string[] = []
  const seasonalPatterns: SpendingProfile['seasonalPatterns'] = []

  // Fetch per-category monthly spending for the snapshot period
  const oldestSnap = snapshots[snapshots.length - 1].month
  const newestSnap = snapshots[0].month
  const oldestDate = typeof oldestSnap === 'string' ? new Date(oldestSnap) : oldestSnap
  const newestDate = typeof newestSnap === 'string' ? new Date(newestSnap) : newestSnap
  const startDate = new Date(oldestDate.getFullYear(), oldestDate.getMonth(), 1)
  const endDate = new Date(newestDate.getFullYear(), newestDate.getMonth() + 1, 0, 23, 59, 59, 999)

  const categoryMonthly = await db.transaction.groupBy({
    by: ['categoryId'],
    where: {
      userId,
      date: { gte: startDate, lte: endDate },
      classification: 'expense',
      amount: { lt: 0 },
      categoryId: { not: null },
    },
    _sum: { amount: true },
    _count: { _all: true },
  })

  // Get category names for the IDs we have
  const categoryIds = categoryMonthly
    .map(c => c.categoryId)
    .filter((id): id is string => id !== null)
  if (categoryIds.length > 0) {
    const categories = await db.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    })
    const categoryNameMap = new Map(categories.map(c => [c.id, c.name]))

    // For each category, compute per-month spending to assess volatility
    const categoryMonthlyData = await db.transaction.groupBy({
      by: ['categoryId', 'date'],
      where: {
        userId,
        date: { gte: startDate, lte: endDate },
        classification: 'expense',
        amount: { lt: 0 },
        categoryId: { in: categoryIds },
      },
      _sum: { amount: true },
    })

    // Aggregate by category + month
    const catMonthTotals = new Map<string, Map<string, number>>()
    for (const row of categoryMonthlyData) {
      if (!row.categoryId) continue
      const monthKey = `${row.date.getFullYear()}-${String(row.date.getMonth() + 1).padStart(2, '0')}`
      if (!catMonthTotals.has(row.categoryId)) catMonthTotals.set(row.categoryId, new Map())
      const monthMap = catMonthTotals.get(row.categoryId)!
      monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + Math.abs(row._sum.amount ?? 0))
    }

    for (const [catId, monthMap] of catMonthTotals) {
      const name = categoryNameMap.get(catId)
      if (!name || monthMap.size < 3) continue
      const values = Array.from(monthMap.values())
      const mean = values.reduce((a, b) => a + b, 0) / values.length
      if (mean < 10) continue // Skip trivial categories
      const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
      const cv = Math.sqrt(variance) / mean // coefficient of variation

      if (cv > 0.5) volatileCategories.push(name)
      else if (cv < 0.15) stableCategories.push(name)

      // Detect seasonal spikes/dips
      for (const [monthKey, total] of monthMap) {
        const mo = parseInt(monthKey.split('-')[1])
        const ratio = total / mean
        if (ratio > 1.5) seasonalPatterns.push({ month: mo, category: name, direction: 'spike' })
        else if (ratio < 0.5) seasonalPatterns.push({ month: mo, category: name, direction: 'dip' })
      }
    }
  }

  const profile: SpendingProfile = {
    monthsOfData: snapshots.length,
    avgMonthlyIncome: avg(incomes),
    avgMonthlyExpense: avg(expenses),
    volatileCategories: volatileCategories.slice(0, 10),
    stableCategories: stableCategories.slice(0, 10),
    seasonalPatterns: seasonalPatterns.slice(0, 20),
    trueRemainingTrend: computeTrend(trueRemainingValues),
    lastUpdated: new Date().toISOString(),
  }

  await updateContext(userId, { spendingProfile: profile })
}

function avg(nums: number[]): number {
  return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length * 100) / 100 : 0
}

function computeTrend(values: number[]): 'improving' | 'stable' | 'declining' {
  if (values.length < 3) return 'stable'
  const mid = Math.floor(values.length / 2)
  const recent = avg(values.slice(0, mid))
  const older = avg(values.slice(mid))
  const change = (recent - older) / Math.abs(older || 1)
  if (change > 0.05) return 'improving'
  if (change < -0.05) return 'declining'
  return 'stable'
}

// ─── Context Assembly for AI Prompts ──────────────────────────────────────────

export async function assembleAIContext(
  userId: string,
  surface: 'categorization' | 'budget_builder' | 'insights' | 'monthly_review'
): Promise<string> {
  const ctx = await db.userAIContext.findUnique({ where: { userId } })
  if (!ctx) return ''

  const sections: string[] = []

  // Always include spending profile if available
  const profile = ctx.spendingProfile as unknown as SpendingProfile
  if (profile?.monthsOfData) {
    sections.push(buildSpendingProfileBlock(profile))
  }

  switch (surface) {
    case 'categorization':
      sections.push(buildCategorizationBlock(ctx.categorizationSignals as unknown as CategorizationSignals))
      break

    case 'budget_builder':
      sections.push(buildBudgetBlock(ctx.budgetSignals as unknown as BudgetSignals))
      sections.push(buildGoalBlock(ctx.goalSignals as unknown as GoalSignals))
      sections.push(buildCategorizationBlock(ctx.categorizationSignals as unknown as CategorizationSignals))
      break

    case 'insights':
      sections.push(buildInsightBlock(ctx.insightSignals as unknown as InsightSignals))
      sections.push(buildGoalBlock(ctx.goalSignals as unknown as GoalSignals))
      break

    case 'monthly_review':
      sections.push(buildInsightBlock(ctx.insightSignals as unknown as InsightSignals))
      sections.push(buildBudgetBlock(ctx.budgetSignals as unknown as BudgetSignals))
      sections.push(buildGoalBlock(ctx.goalSignals as unknown as GoalSignals))
      break
  }

  const filtered = sections.filter(Boolean)
  if (filtered.length === 0) return ''

  return `## User Learning Context\n${filtered.join('\n\n')}`
}

// ─── Block Formatters ─────────────────────────────────────────────────────────

function buildCategorizationBlock(signals: CategorizationSignals): string {
  if (!signals?.correctionCount) return ''

  const lines: string[] = []
  lines.push(`The user has corrected ${signals.correctionCount} categorizations.`)

  const lowConf = Object.entries(signals.categoryConfidence || {})
    .filter(([, v]) => v < 0.4)
    .map(([k]) => k)
  if (lowConf.length) {
    lines.push(`Categories with low confidence (frequent corrections): ${lowConf.join(', ')}.`)
  }

  const recent = (signals.topCorrectedMerchants || []).slice(0, 5)
  if (recent.length) {
    const corrStr = recent.map(c => `${c.merchant}: ${c.from} → ${c.to}`).join('; ')
    lines.push(`Recent corrections: ${corrStr}.`)
  }

  lines.push("Prefer the user's demonstrated preferences over default mappings.")
  return lines.join('\n')
}

function buildInsightBlock(signals: InsightSignals): string {
  if (!signals?.totalShown) return ''

  const lines: string[] = []
  const engagementRate = signals.totalShown > 0
    ? Math.round((signals.totalActedOn || 0) / signals.totalShown * 100)
    : 0
  lines.push(`Insight engagement: ${engagementRate}% acted on (${signals.totalActedOn || 0}/${signals.totalShown} shown).`)

  const topDismissed = Object.entries(signals.dismissedTypes || {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
  if (topDismissed.length) {
    lines.push(`Most dismissed types: ${topDismissed.map(([t, c]) => `${t} (${c}x)`).join(', ')}. Deprioritize these.`)
  }

  const topEngaged = Object.entries(signals.engagedTypes || {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
  if (topEngaged.length) {
    lines.push(`Most engaged types: ${topEngaged.map(([t, c]) => `${t} (${c}x)`).join(', ')}. Prioritize these.`)
  }

  const recentDismissals = (signals.recentDismissals || []).slice(0, 5)
  if (recentDismissals.length) {
    lines.push(`Recently dismissed insights (avoid repeating): ${recentDismissals.join('; ')}.`)
  }

  return lines.join('\n')
}

function buildBudgetBlock(signals: BudgetSignals): string {
  if (!signals?.generationCount) return ''

  const lines: string[] = []
  lines.push(`Budget generation history: ${signals.generationCount} proposals generated.`)

  const adjustments = (signals.adjustmentPatterns || []).slice(0, 5)
  if (adjustments.length) {
    const adjStr = adjustments.map(a =>
      `${a.category}: suggested $${a.suggestedAmount} → user set $${a.finalAmount} (${a.direction})`
    ).join('; ')
    lines.push(`Recent user adjustments: ${adjStr}.`)
    lines.push('Align future proposals with these demonstrated preferences.')
  }

  const rejected = (signals.rejectedCategories || []).slice(0, 5)
  if (rejected.length) {
    lines.push(`Categories user consistently removes: ${rejected.join(', ')}. Consider excluding.`)
  }

  const added = (signals.addedCategories || []).slice(0, 5)
  if (added.length) {
    lines.push(`Categories user consistently adds: ${added.join(', ')}. Include proactively.`)
  }

  if (signals.preferredTierDistribution) {
    const d = signals.preferredTierDistribution
    lines.push(`Preferred tier split: Fixed ${Math.round(d.fixed * 100)}%, Flexible ${Math.round(d.flexible * 100)}%, Annual ${Math.round(d.annual * 100)}%.`)
  }

  return lines.join('\n')
}

function buildGoalBlock(signals: GoalSignals): string {
  if (!signals) return ''

  const lines: string[] = []

  if (signals.paceStatus) {
    lines.push(`Goal pace: ${signals.paceStatus.replace('_', ' ')}.`)
  }

  const history = (signals.recalibrationHistory || []).slice(0, 3)
  if (history.length) {
    const accepted = history.filter(h => h.accepted).length
    const total = history.length
    lines.push(`Recalibration history: ${accepted}/${total} suggestions accepted.`)
    if (accepted === 0 && total >= 2) {
      lines.push('User tends to reject recalibration — be conservative with goal adjustment suggestions.')
    }
  }

  return lines.join('\n')
}

function buildSpendingProfileBlock(profile: SpendingProfile): string {
  if (!profile?.monthsOfData) return ''

  const lines: string[] = []
  lines.push(`Spending profile (${profile.monthsOfData} months): avg income $${profile.avgMonthlyIncome.toLocaleString()}/mo, avg expense $${profile.avgMonthlyExpense.toLocaleString()}/mo.`)

  if (profile.trueRemainingTrend !== 'stable') {
    lines.push(`True Remaining trend: ${profile.trueRemainingTrend}.`)
  }

  if (profile.volatileCategories.length) {
    lines.push(`Volatile categories (high month-to-month variance): ${profile.volatileCategories.join(', ')}.`)
  }

  if (profile.stableCategories.length) {
    lines.push(`Stable categories (consistent spending): ${profile.stableCategories.join(', ')}.`)
  }

  const relevantSeasonal = profile.seasonalPatterns.slice(0, 5)
  if (relevantSeasonal.length) {
    const seasonStr = relevantSeasonal.map(s => {
      const monthName = new Date(2026, s.month - 1).toLocaleString('en-US', { month: 'short' })
      return `${s.category} ${s.direction}s in ${monthName}`
    }).join(', ')
    lines.push(`Seasonal patterns: ${seasonStr}.`)
  }

  return lines.join('\n')
}
