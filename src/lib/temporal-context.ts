import { db } from './db'

export interface TemporalContext {
  currentMonth: string // "February"
  currentYear: number
  dayOfMonth: number
  daysLeftInMonth: number
  weekOfMonth: number // 1-5
  isEndOfMonth: boolean // last 5 days
  isStartOfMonth: boolean // first 5 days
  isPaydayWeek: boolean // rough heuristic: 1st/15th ± 3 days
  season: string // "winter", "spring", "summer", "fall"
  upcomingHolidays: string[] // holidays within 30 days
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const HOLIDAYS: { month: number; day: number; name: string }[] = [
  { month: 1, day: 1, name: 'New Year\'s Day' },
  { month: 2, day: 14, name: 'Valentine\'s Day' },
  { month: 5, day: 26, name: 'Memorial Day' },
  { month: 7, day: 4, name: 'Independence Day' },
  { month: 9, day: 1, name: 'Labor Day' },
  { month: 10, day: 31, name: 'Halloween' },
  { month: 11, day: 27, name: 'Thanksgiving' },
  { month: 12, day: 25, name: 'Christmas' },
  { month: 12, day: 31, name: 'New Year\'s Eve' },
]

function getSeason(month: number): string {
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'fall'
  return 'winter'
}

export function buildTemporalContext(now: Date = new Date()): TemporalContext {
  const month = now.getMonth() // 0-indexed
  const year = now.getFullYear()
  const dayOfMonth = now.getDate()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysLeftInMonth = daysInMonth - dayOfMonth
  const weekOfMonth = Math.ceil(dayOfMonth / 7)

  const isPaydayWeek = (dayOfMonth >= 1 && dayOfMonth <= 3) ||
    (dayOfMonth >= 13 && dayOfMonth <= 17)

  // Find holidays within the next 30 days
  const upcomingHolidays: string[] = []
  for (const h of HOLIDAYS) {
    const holidayDate = new Date(year, h.month - 1, h.day)
    const diffDays = Math.ceil(
      (holidayDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    )
    if (diffDays >= 0 && diffDays <= 30) {
      upcomingHolidays.push(h.name)
    }
  }

  return {
    currentMonth: MONTH_NAMES[month],
    currentYear: year,
    dayOfMonth,
    daysLeftInMonth,
    weekOfMonth,
    isEndOfMonth: daysLeftInMonth <= 5,
    isStartOfMonth: dayOfMonth <= 5,
    isPaydayWeek,
    season: getSeason(month + 1),
    upcomingHolidays,
  }
}

export interface SpendingVelocity {
  dailyAverage: number
  projectedMonthTotal: number
  comparedToLastMonth: number // percentage change
}

export async function getSpendingVelocity(userId: string): Promise<SpendingVelocity> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const dayOfMonth = now.getDate()

  // Current month spending so far (exclude transfers)
  const currentAgg = await db.transaction.aggregate({
    where: {
      userId,
      date: { gte: startOfMonth, lte: now },
      classification: 'expense',
      amount: { lt: 0 },
    },
    _sum: { amount: true },
  })

  const spentSoFar = Math.abs(currentAgg._sum.amount ?? 0)
  const dailyAverage = dayOfMonth > 0 ? spentSoFar / dayOfMonth : 0
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const projectedMonthTotal = dailyAverage * daysInMonth

  // Last month total (exclude transfers)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)

  const lastAgg = await db.transaction.aggregate({
    where: {
      userId,
      date: { gte: lastMonthStart, lte: lastMonthEnd },
      classification: 'expense',
      amount: { lt: 0 },
    },
    _sum: { amount: true },
  })

  const lastMonthTotal = Math.abs(lastAgg._sum.amount ?? 0)
  const comparedToLastMonth = lastMonthTotal > 0
    ? ((projectedMonthTotal - lastMonthTotal) / lastMonthTotal) * 100
    : 0

  return { dailyAverage, projectedMonthTotal, comparedToLastMonth }
}
