// ─── Insight types ──────────────────────────────────────────────────────────

export type InsightCategory = 'spending' | 'debt' | 'savings' | 'tax' | 'subscription'

export type InsightType = 'waste' | 'optimization' | 'alert' | 'opportunity'

export type InsightPriority = 'high' | 'medium' | 'low'

export type InsightStatus = 'active' | 'dismissed' | 'completed'

export type InsightDifficulty = 'easy' | 'moderate' | 'hard'

export type EfficiencyRating = 'excellent' | 'good' | 'average' | 'high' | 'excessive'

export interface Insight {
  id: string
  userId: string
  category: InsightCategory
  type: InsightType
  priority: InsightPriority
  title: string
  description: string
  savingsAmount: number | null
  actionItems: string // JSON array
  status: InsightStatus
  metadata: string | null // JSON blob
  relatedTransactionIds: unknown // JSON: string[] of transaction IDs
  relatedQuery: unknown // JSON: Record<string, string> query params
  generatedAt: Date
  expiresAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface EfficiencyScore {
  id: string
  userId: string
  overallScore: number
  spendingScore: number
  savingsScore: number
  debtScore: number
  period: string
  breakdown: string // JSON
  createdAt: Date
}

export interface TransactionSummary {
  totalIncome: number
  totalExpenses: number
  netSavings: number
  savingsRate: number
  categoryBreakdown: CategoryBreakdownItem[]
  topMerchants: MerchantSummary[]
  recurringCharges: RecurringCharge[]
  monthOverMonthChange: MonthOverMonthItem[]
  period: { start: string; end: string; months: number }
}

export interface CategoryBreakdownItem {
  category: string
  total: number
  transactionCount: number
  avgTransaction: number
  benchmark?: {
    median: number
    percentile25: number
    rating: EfficiencyRating
  }
}

export interface MerchantSummary {
  name: string
  total: number
  count: number
  category: string
}

export interface RecurringCharge {
  description: string
  amount: number
  frequency: string
}

export interface MonthOverMonthItem {
  category: string
  currentMonth: number
  previousMonth: number
  changePercent: number
}

export interface AIInsightResponse {
  insights: {
    category: string
    type: string
    priority: string
    title: string
    description: string
    savingsAmount: number
    savingsFrequency: string
    actionItems: string[]
    difficulty: string
  }[]
  efficiencyScore: {
    overall: number
    spending: number
    savings: number
    debt: number
    summary: string
  }
  highlightStat: {
    label: string
    value: number
    context: string
  }
}

export interface SpendingBenchmark {
  category: string
  monthlyMedian: number
  p25: number
  p75: number
  source: string
}
