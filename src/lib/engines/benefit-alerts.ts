/**
 * Benefit alert engine — pure logic module.
 *
 * Computes expiring/unused benefit alerts based on credit cycle timing.
 * No database imports, no auth, no framework dependencies.
 */

export type AlertSeverity = 'urgent' | 'warning' | 'info'

export interface BenefitAlertInput {
  benefitId: string
  benefitName: string
  cardIssuer: string
  cardName: string
  userCardId: string
  creditAmount: number
  creditCycle: string // BenefitRefreshCycle
  usedAmount: number
  lastResetDate: string | Date | null
  isOptedIn: boolean
  openedDate: string | Date | null
}

export interface BenefitAlert {
  benefitId: string
  userCardId: string
  cardLabel: string
  benefitName: string
  creditAmount: number
  usedAmount: number
  remaining: number
  severity: AlertSeverity
  message: string
  daysUntilReset: number | null
  resetDate: string | null
}

/**
 * Compute the next reset date for a benefit cycle.
 */
function computeResetDate(
  cycle: string,
  lastResetDate: Date | null,
  openedDate: Date | null,
  asOf: Date,
): Date | null {
  switch (cycle) {
    case 'MONTHLY': {
      return new Date(asOf.getFullYear(), asOf.getMonth() + 1, 1)
    }
    case 'QUARTERLY': {
      const currentQ = Math.floor(asOf.getMonth() / 3)
      return new Date(asOf.getFullYear(), (currentQ + 1) * 3, 1)
    }
    case 'CALENDAR_YEAR':
    case 'ANNUALLY': {
      return new Date(asOf.getFullYear() + 1, 0, 1)
    }
    case 'CARDMEMBER_YEAR': {
      if (!openedDate) return null
      const opened = new Date(openedDate)
      // Anniversary is the opened month/day each year
      const nextAnniversary = new Date(asOf.getFullYear(), opened.getMonth(), opened.getDate())
      if (nextAnniversary <= asOf) {
        nextAnniversary.setFullYear(nextAnniversary.getFullYear() + 1)
      }
      return nextAnniversary
    }
    default:
      return null
  }
}

/**
 * Compute alerts for a list of benefits with statement credits.
 *
 * @param benefits - Benefits with credit tracking info
 * @param asOf - Current date (for testability)
 * @returns Array of alerts sorted by severity (urgent first)
 */
export function computeBenefitAlerts(
  benefits: BenefitAlertInput[],
  asOf: Date = new Date(),
): BenefitAlert[] {
  const alerts: BenefitAlert[] = []

  for (const b of benefits) {
    if (!b.isOptedIn) continue
    if (b.creditAmount <= 0) continue

    const remaining = Math.max(0, b.creditAmount - b.usedAmount)
    if (remaining <= 0) continue // Fully used — no alert needed

    const lastReset = b.lastResetDate ? new Date(b.lastResetDate) : null
    const opened = b.openedDate ? new Date(b.openedDate) : null
    const resetDate = computeResetDate(b.creditCycle, lastReset, opened, asOf)

    if (!resetDate) continue

    const daysUntilReset = Math.ceil(
      (resetDate.getTime() - asOf.getTime()) / (24 * 60 * 60 * 1000),
    )

    // Skip if reset is far away and mostly used
    if (daysUntilReset > 60 && remaining < b.creditAmount * 0.5) continue

    const cardLabel = `${b.cardIssuer} ${b.cardName}`
    const pctUsed = Math.round((b.usedAmount / b.creditAmount) * 100)

    let severity: AlertSeverity
    let message: string

    if (daysUntilReset <= 14 && pctUsed < 50) {
      severity = 'urgent'
      message = `${formatCurrency(remaining)} of your ${b.benefitName} credit expires in ${daysUntilReset} days. Only ${pctUsed}% used.`
    } else if (daysUntilReset <= 30 && pctUsed < 75) {
      severity = 'warning'
      message = `${formatCurrency(remaining)} remaining on ${b.benefitName} — resets in ${daysUntilReset} days.`
    } else if (daysUntilReset <= 60 && pctUsed === 0) {
      severity = 'warning'
      message = `You haven't used your ${formatCurrency(b.creditAmount)} ${b.benefitName} credit yet. Resets in ${daysUntilReset} days.`
    } else if (daysUntilReset <= 60) {
      severity = 'info'
      message = `${formatCurrency(remaining)} left on ${b.benefitName} (${pctUsed}% used). Resets in ${daysUntilReset} days.`
    } else {
      continue // Too far away to alert
    }

    alerts.push({
      benefitId: b.benefitId,
      userCardId: b.userCardId,
      cardLabel,
      benefitName: b.benefitName,
      creditAmount: b.creditAmount,
      usedAmount: b.usedAmount,
      remaining,
      severity,
      message,
      daysUntilReset,
      resetDate: resetDate.toISOString().split('T')[0],
    })
  }

  // Sort: urgent first, then warning, then info
  const severityOrder: Record<AlertSeverity, number> = { urgent: 0, warning: 1, info: 2 }
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  return alerts
}

function formatCurrency(amount: number): string {
  return `$${Math.round(amount).toLocaleString()}`
}
