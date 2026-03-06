import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { getBenchmark, getEfficiencyRating } from '@/lib/engines/benchmarks'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const months = Math.min(Math.max(parseInt(searchParams.get('months') ?? '12', 10) || 12, 1), 12)

  const startDate = new Date()
  startDate.setMonth(startDate.getMonth() - months)
  startDate.setDate(1)
  startDate.setHours(0, 0, 0, 0)

  const transactions = await db.transaction.findMany({
    where: {
      userId: session.userId,
      date: { gte: startDate },
      classification: { not: 'transfer' },
    },
    include: {
      category: { select: { id: true, name: true, group: true, type: true } },
    },
    orderBy: { date: 'asc' },
  })

  // --- Monthly breakdown ---
  const monthMap = new Map<
    string,
    {
      categories: Map<string, { categoryId: string; categoryName: string; total: number; count: number }>
      totalIncome: number
      totalExpenses: number
    }
  >()

  for (const tx of transactions) {
    const monthKey = tx.date.toISOString().slice(0, 7) // "2026-03"
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, { categories: new Map(), totalIncome: 0, totalExpenses: 0 })
    }
    const bucket = monthMap.get(monthKey)!

    if (tx.classification === 'income') {
      bucket.totalIncome += tx.amount
    } else {
      bucket.totalExpenses += tx.amount // negative
    }

    const catId = tx.category?.id ?? 'uncategorized'
    const catName = tx.category?.name ?? 'Uncategorized'
    if (tx.classification === 'expense') {
      if (!bucket.categories.has(catId)) {
        bucket.categories.set(catId, { categoryId: catId, categoryName: catName, total: 0, count: 0 })
      }
      const cat = bucket.categories.get(catId)!
      cat.total += tx.amount // negative
      cat.count += 1
    }
  }

  const monthlyBreakdown = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => {
      const categories = Array.from(data.categories.values()).map((c) => ({
        categoryId: c.categoryId,
        categoryName: c.categoryName,
        total: c.total,
        transactionCount: c.count,
        avgTransaction: c.count > 0 ? c.total / c.count : 0,
      }))

      const savingsRate =
        data.totalIncome > 0
          ? ((data.totalIncome + data.totalExpenses) / data.totalIncome) * 100
          : 0

      return {
        month,
        categories: categories.sort((a, b) => a.total - b.total), // most negative first
        totalIncome: data.totalIncome,
        totalExpenses: data.totalExpenses,
        savingsRate: Math.round(savingsRate * 10) / 10,
      }
    })

  // --- Top merchants ---
  const expenseTxs = transactions.filter((t) => t.classification === 'expense')
  const merchantMap = new Map<
    string,
    {
      totalSpent: number
      count: number
      categoryName: string
      firstSeen: Date
      lastSeen: Date
      amounts: number[]
    }
  >()

  for (const tx of expenseTxs) {
    const merchant = tx.merchant
    if (!merchantMap.has(merchant)) {
      merchantMap.set(merchant, {
        totalSpent: 0,
        count: 0,
        categoryName: tx.category?.name ?? 'Uncategorized',
        firstSeen: tx.date,
        lastSeen: tx.date,
        amounts: [],
      })
    }
    const m = merchantMap.get(merchant)!
    m.totalSpent += tx.amount // negative
    m.count += 1
    m.amounts.push(Math.abs(tx.amount))
    if (tx.date < m.firstSeen) m.firstSeen = tx.date
    if (tx.date > m.lastSeen) m.lastSeen = tx.date
  }

  const topMerchants = Array.from(merchantMap.entries())
    .map(([merchant, data]) => {
      const avg = data.amounts.reduce((s, v) => s + v, 0) / data.amounts.length
      const allSimilar = data.amounts.length >= 3 && data.amounts.every((a) => Math.abs(a - avg) / avg < 0.1)
      return {
        merchant,
        totalSpent: data.totalSpent,
        transactionCount: data.count,
        avgTransaction: data.totalSpent / data.count,
        categoryName: data.categoryName,
        firstSeen: data.firstSeen.toISOString(),
        lastSeen: data.lastSeen.toISOString(),
        isRecurring: allSimilar,
      }
    })
    .sort((a, b) => a.totalSpent - b.totalSpent) // most negative first
    .slice(0, 25)

  // --- Recurring charges ---
  const recurringCharges: {
    merchant: string
    amount: number
    frequency: 'monthly' | 'quarterly' | 'annual'
    categoryName: string
    lastCharged: string
  }[] = []

  for (const [merchant, data] of merchantMap) {
    if (data.amounts.length < 2) continue
    const avg = data.amounts.reduce((s, v) => s + v, 0) / data.amounts.length
    const allSimilar = data.amounts.every((a) => Math.abs(a - avg) / avg < 0.1)
    if (!allSimilar) continue

    // Determine frequency based on count relative to months
    let frequency: 'monthly' | 'quarterly' | 'annual'
    const ratio = data.count / months
    if (ratio >= 0.7) frequency = 'monthly'
    else if (ratio >= 0.2) frequency = 'quarterly'
    else frequency = 'annual'

    recurringCharges.push({
      merchant,
      amount: -avg, // negative (expense)
      frequency,
      categoryName: data.categoryName,
      lastCharged: data.lastSeen.toISOString(),
    })
  }

  recurringCharges.sort((a, b) => a.amount - b.amount) // most expensive first (most negative)

  // --- BLS benchmark comparison ---
  // Compute per-category monthly averages and compare to BLS data
  const categoryMonthlyTotals = new Map<string, { name: string; totalAbsolute: number }>()
  for (const tx of expenseTxs) {
    const catName = tx.category?.name ?? 'Uncategorized'
    const catGroup = tx.category?.group ?? ''
    const matchKey = catGroup || catName
    if (!categoryMonthlyTotals.has(matchKey)) {
      categoryMonthlyTotals.set(matchKey, { name: matchKey, totalAbsolute: 0 })
    }
    categoryMonthlyTotals.get(matchKey)!.totalAbsolute += Math.abs(tx.amount)
  }

  const benchmarks: {
    categoryName: string
    userMonthlyAvg: number
    blsMedian: number
    blsP25: number
    blsP75: number
    rating: string
  }[] = []

  for (const [key, data] of categoryMonthlyTotals) {
    const benchmark = getBenchmark(key)
    if (!benchmark) continue

    const userMonthlyAvg = data.totalAbsolute / months
    const rating = getEfficiencyRating(userMonthlyAvg, benchmark)

    benchmarks.push({
      categoryName: key,
      userMonthlyAvg,
      blsMedian: benchmark.monthlyMedian,
      blsP25: benchmark.p25,
      blsP75: benchmark.p75,
      rating,
    })
  }

  benchmarks.sort((a, b) => b.userMonthlyAvg - a.userMonthlyAvg)

  // --- Summary ---
  const totalIncome = monthlyBreakdown.reduce((s, m) => s + m.totalIncome, 0)
  const totalExpenses = monthlyBreakdown.reduce((s, m) => s + m.totalExpenses, 0)
  const monthCount = monthlyBreakdown.length || 1

  const summary = {
    avgMonthlyIncome: totalIncome / monthCount,
    avgMonthlyExpenses: totalExpenses / monthCount,
    avgSavingsRate:
      totalIncome > 0
        ? Math.round(((totalIncome + totalExpenses) / totalIncome) * 1000) / 10
        : 0,
    totalCategories: new Set(expenseTxs.map((t) => t.category?.id).filter(Boolean)).size,
    totalMerchants: merchantMap.size,
    dateRange: {
      from: startDate.toISOString(),
      to: new Date().toISOString(),
    },
  }

  const response = NextResponse.json({
    monthlyBreakdown,
    topMerchants,
    recurringCharges,
    benchmarks,
    summary,
  })

  // Cache for 5 minutes
  response.headers.set('Cache-Control', 'private, max-age=300')

  return response
}
