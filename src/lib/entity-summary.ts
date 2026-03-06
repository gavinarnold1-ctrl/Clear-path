import { db } from './db'
import { calculateDepreciation } from './engines/tax'

/**
 * Build a formatted entity summary string for the AI monthly review prompt.
 * Aggregates income, expenses, and depreciation per property/business.
 * Returns null if user has no properties.
 */
export async function getEntitySummary(
  userId: string,
  year: number,
  month: number,
): Promise<string | null> {
  const properties = await db.property.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      type: true,
      taxSchedule: true,
      purchasePrice: true,
      purchaseDate: true,
      buildingValuePct: true,
      priorDepreciation: true,
      currentValue: true,
    },
  })

  if (properties.length === 0) return null

  const startDate = new Date(year, month, 1)
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999)

  // Get direct property transactions
  const directTxs = await db.transaction.findMany({
    where: {
      userId,
      date: { gte: startDate, lte: endDate },
      propertyId: { not: null },
    },
    select: { propertyId: true, amount: true, classification: true },
  })

  // Get split allocations
  const splits = await db.transactionSplit.findMany({
    where: {
      transaction: {
        userId,
        date: { gte: startDate, lte: endDate },
      },
    },
    select: {
      propertyId: true,
      amount: true,
      transaction: { select: { classification: true } },
    },
  })

  const lines: string[] = []
  let totalRentalNet = 0
  let totalBusinessExpenses = 0
  let totalAnnualDepreciation = 0

  for (const prop of properties) {
    const propDirect = directTxs.filter((t) => t.propertyId === prop.id)
    const propSplits = splits.filter((s) => s.propertyId === prop.id)

    let income = 0
    let expenses = 0

    for (const tx of propDirect) {
      if (tx.classification === 'income' || tx.amount > 0) income += Math.abs(tx.amount)
      else expenses += Math.abs(tx.amount)
    }
    for (const s of propSplits) {
      if (s.transaction.classification === 'income' || s.amount > 0) income += Math.abs(s.amount)
      else expenses += Math.abs(s.amount)
    }

    // Skip properties with no activity
    if (income === 0 && expenses === 0) continue

    let depreciation = 0
    if (prop.type === 'RENTAL' && prop.purchasePrice && prop.purchaseDate) {
      const depResult = calculateDepreciation({
        purchasePrice: Number(prop.purchasePrice),
        purchaseDate: prop.purchaseDate,
        buildingValuePct: Number(prop.buildingValuePct ?? 80),
        priorDepreciation: Number(prop.priorDepreciation ?? 0),
        asOfDate: endDate,
      })
      depreciation = depResult.monthlyDepreciation
      totalAnnualDepreciation += depResult.annualDepreciation
    }

    const net = Math.round((income - expenses - depreciation) * 100) / 100
    const typeLabel = prop.type === 'RENTAL' ? 'Rental' : prop.type === 'BUSINESS' ? 'Business' : 'Personal'

    let line = `- ${prop.name} (${typeLabel}):`
    if (income > 0) line += ` Income $${Math.round(income).toLocaleString()}`
    if (expenses > 0) line += `, Expenses $${Math.round(expenses).toLocaleString()}`
    if (depreciation > 0) line += `, Depreciation $${Math.round(depreciation).toLocaleString()}`
    line += `, Net $${net.toLocaleString()}`
    lines.push(line)

    // Computed metrics for AI context
    const metrics = computePropertyMetrics({
      type: prop.type,
      currentValue: prop.currentValue,
      purchasePrice: prop.purchasePrice ? Number(prop.purchasePrice) : null,
      purchaseDate: prop.purchaseDate,
      buildingValuePct: prop.buildingValuePct ? Number(prop.buildingValuePct) : null,
    }, income, expenses)
    if (metrics) lines.push(`  Metrics: ${metrics}`)

    if (prop.type === 'RENTAL') totalRentalNet += net
    if (prop.type === 'BUSINESS') totalBusinessExpenses += expenses
  }

  if (lines.length === 0) return null

  lines.push('')
  if (totalRentalNet !== 0) {
    lines.push(`Total rental net income: $${Math.round(totalRentalNet).toLocaleString()}/month`)
  }
  if (totalBusinessExpenses > 0) {
    lines.push(`Total business expenses: $${Math.round(totalBusinessExpenses).toLocaleString()}/month`)
  }
  if (totalAnnualDepreciation > 0) {
    lines.push(`Annual depreciation claim: $${Math.round(totalAnnualDepreciation).toLocaleString()}`)
  }

  return lines.join('\n')
}

function computePropertyMetrics(
  property: {
    type: string
    currentValue?: number | null
    purchasePrice?: number | null
    purchaseDate?: Date | null
    buildingValuePct?: number | null
  },
  monthlyIncome: number,
  monthlyExpenses: number,
): string | null {
  const parts: string[] = []

  if (property.type === 'RENTAL' && property.currentValue && property.currentValue > 0) {
    const annualRent = monthlyIncome * 12
    const annualExpenses = monthlyExpenses * 12
    if (annualRent > 0) {
      const netYield = ((annualRent - annualExpenses) / property.currentValue * 100).toFixed(1)
      parts.push(`Net rental yield: ${netYield}%`)
      const noi = annualRent - annualExpenses
      if (noi > 0) {
        parts.push(`Cap rate: ${(noi / property.currentValue * 100).toFixed(1)}%`)
      }
    }
  }

  if (property.type === 'BUSINESS' && monthlyIncome > 0) {
    const profitMargin = ((monthlyIncome - monthlyExpenses) / monthlyIncome * 100).toFixed(1)
    parts.push(`Profit margin: ${profitMargin}%`)
  }

  // Depreciation exhaustion warning
  if (property.purchasePrice && property.purchaseDate) {
    const yearsElapsed = (Date.now() - new Date(property.purchaseDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    const yearsRemaining = Math.max(0, 27.5 - yearsElapsed)
    if (yearsRemaining < 3 && yearsRemaining > 0) {
      parts.push(`Depreciation exhausted in ${yearsRemaining.toFixed(1)} years`)
    }
  }

  return parts.length > 0 ? parts.join('. ') : null
}
