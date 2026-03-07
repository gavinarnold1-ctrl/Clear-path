import type { BudgetProposal } from './budget-builder'

export interface GenerationRecord {
  status: 'pending' | 'complete' | 'error'
  proposal?: BudgetProposal
  profile?: {
    totalMonthlyIncome: number
    averageMonthlyExpenses: number
    monthsOfData: number
    totalTransactions: number
    savingsRate: number
    incomeStreams: number
    detectedFixed: number
    variableCategories: number
  }
  goalContext?: { goalLabel: string; primaryGoal: string } | null
  error?: string
  createdAt: number
}

// In-memory store — resets on deploy, but generations complete in 30-45s
const generations = new Map<string, GenerationRecord>()

// Clean up stale entries older than 10 minutes
function cleanup() {
  const cutoff = Date.now() - 10 * 60 * 1000
  for (const [key, rec] of generations) {
    if (rec.createdAt < cutoff) generations.delete(key)
  }
}

export function getGeneration(userId: string): GenerationRecord | undefined {
  cleanup()
  return generations.get(userId)
}

export function setGeneration(userId: string, record: GenerationRecord) {
  generations.set(userId, record)
}

export function clearGeneration(userId: string) {
  generations.delete(userId)
}
