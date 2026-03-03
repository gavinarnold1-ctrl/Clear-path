/**
 * Property ↔ Debt bidirectional sync.
 *
 * When a Property's financial fields are saved and the property has a mortgage:
 * - If a Debt record exists with propertyId matching, update it
 * - If no Debt record exists, auto-create one
 *
 * When a MORTGAGE Debt with a propertyId is updated, sync shared fields back to the Property.
 */
import { db } from '@/lib/db'

interface PropertyFinancialFields {
  loanBalance?: number | null
  interestRate?: number | null
  monthlyPayment?: number | null
  monthlyPropertyTax?: number | null
  monthlyInsurance?: number | null
  monthlyPMI?: number | null
  monthlyHOA?: number | null
  loanTermMonths?: number | null
  loanStartDate?: Date | null
}

/**
 * Sync Property → Debt.
 * Called after a property with mortgage details is saved.
 */
export async function syncPropertyToDebt(
  propertyId: string,
  userId: string,
  propertyName: string,
  fields: PropertyFinancialFields,
): Promise<void> {
  // Only sync if there's actual loan data
  if (fields.loanBalance == null && fields.monthlyPayment == null) return

  const escrowAmount =
    (fields.monthlyPropertyTax ?? 0) +
    (fields.monthlyInsurance ?? 0) +
    (fields.monthlyPMI ?? 0)

  const existing = await db.debt.findFirst({
    where: { propertyId, userId },
  })

  if (existing) {
    await db.debt.update({
      where: { id: existing.id },
      data: {
        ...(fields.loanBalance != null && { currentBalance: fields.loanBalance }),
        ...(fields.interestRate != null && { interestRate: fields.interestRate }),
        ...(fields.monthlyPayment != null && { minimumPayment: fields.monthlyPayment }),
        ...(escrowAmount > 0 && { escrowAmount }),
        ...(fields.loanTermMonths != null && { termMonths: fields.loanTermMonths }),
        ...(fields.loanStartDate !== undefined && { startDate: fields.loanStartDate }),
      },
    })
  } else if (fields.loanBalance != null && fields.loanBalance > 0) {
    await db.debt.create({
      data: {
        userId,
        name: `${propertyName} Mortgage`,
        type: 'MORTGAGE',
        currentBalance: fields.loanBalance,
        interestRate: fields.interestRate ?? 0,
        minimumPayment: fields.monthlyPayment ?? 0,
        escrowAmount: escrowAmount > 0 ? escrowAmount : null,
        termMonths: fields.loanTermMonths ?? null,
        startDate: fields.loanStartDate ?? null,
        propertyId,
      },
    })
  }
}

/**
 * Sync Debt → Property.
 * Called after a MORTGAGE debt with a propertyId is updated.
 */
export async function syncDebtToProperty(
  debtId: string,
  propertyId: string,
  debtFields: {
    currentBalance?: number
    interestRate?: number
    minimumPayment?: number
    escrowAmount?: number | null
    termMonths?: number | null
    startDate?: Date | null
  },
): Promise<void> {
  const data: Record<string, unknown> = {}

  if (debtFields.currentBalance !== undefined) {
    data.loanBalance = debtFields.currentBalance
  }
  if (debtFields.interestRate !== undefined) {
    data.interestRate = debtFields.interestRate
  }
  if (debtFields.minimumPayment !== undefined) {
    data.monthlyPayment = debtFields.minimumPayment
  }
  if (debtFields.termMonths !== undefined) {
    data.loanTermMonths = debtFields.termMonths
  }
  if (debtFields.startDate !== undefined) {
    data.loanStartDate = debtFields.startDate
  }

  if (Object.keys(data).length > 0) {
    await db.property.update({
      where: { id: propertyId },
      data,
    })
  }
}
