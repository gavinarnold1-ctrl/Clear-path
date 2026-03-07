import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { syncPropertyToDebt } from '@/lib/property-debt-sync'
import type { TaxSchedule } from '@prisma/client'

const VALID_TYPES = new Set<string>(['PERSONAL', 'RENTAL', 'BUSINESS'])

const TAX_SCHEDULE_MAP: Record<string, TaxSchedule> = {
  PERSONAL: 'SCHEDULE_A',
  RENTAL: 'SCHEDULE_E',
  BUSINESS: 'SCHEDULE_C',
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await db.property.findFirst({
    where: { id, userId: session.userId },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const {
    name, type, isDefault,
    address, city, state, zipCode,
    taxSchedule,
    purchasePrice, purchaseDate, buildingValuePct, priorDepreciation,
    groupId, splitPct,
    // Financial details
    currentValue, loanBalance, monthlyPayment: bodyMonthlyPayment,
    interestRate: bodyInterestRate, loanTermMonths, loanStartDate,
    monthlyPropertyTax, monthlyInsurance, monthlyHOA, monthlyPMI,
    appreciationRate, monthlyRentalIncome,
  } = body

  if (type !== undefined && !VALID_TYPES.has(type)) {
    return NextResponse.json({ error: 'Type must be PERSONAL, RENTAL, or BUSINESS' }, { status: 400 })
  }

  // R10.2a: Duplicate name prevention on rename (case-insensitive)
  if (name !== undefined && name.trim()) {
    const duplicate = await db.property.findFirst({
      where: {
        userId: session.userId,
        name: { equals: name.trim(), mode: 'insensitive' },
        id: { not: id },
      },
    })
    if (duplicate) {
      return NextResponse.json(
        { error: 'A property with this name already exists' },
        { status: 409 }
      )
    }
  }

  // Validate groupId belongs to the user
  if (groupId !== undefined && groupId !== null) {
    const group = await db.propertyGroup.findFirst({
      where: { id: groupId, userId: session.userId },
    })
    if (!group) {
      return NextResponse.json({ error: 'Property group not found' }, { status: 404 })
    }
  }

  // If setting as default, unset any existing default
  if (isDefault && !existing.isDefault) {
    await db.property.updateMany({
      where: { userId: session.userId, isDefault: true },
      data: { isDefault: false },
    })
  }

  // Auto-update taxSchedule when type changes (unless explicitly overridden)
  let resolvedTaxSchedule: TaxSchedule | null | undefined = undefined
  if (taxSchedule !== undefined) {
    resolvedTaxSchedule = taxSchedule
  } else if (type !== undefined) {
    resolvedTaxSchedule = TAX_SCHEDULE_MAP[type as string] ?? null
  }

  const updated = await db.property.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(type !== undefined && { type }),
      ...(isDefault !== undefined && { isDefault }),
      // Address fields
      ...(address !== undefined && { address: address?.trim() || null }),
      ...(city !== undefined && { city: city?.trim() || null }),
      ...(state !== undefined && { state: state?.trim() || null }),
      ...(zipCode !== undefined && { zipCode: zipCode?.trim() || null }),
      // Tax schedule
      ...(resolvedTaxSchedule !== undefined && { taxSchedule: resolvedTaxSchedule }),
      // Depreciation fields
      ...(purchasePrice !== undefined && { purchasePrice }),
      ...(purchaseDate !== undefined && { purchaseDate: purchaseDate ? new Date(purchaseDate) : null }),
      ...(buildingValuePct !== undefined && { buildingValuePct }),
      ...(priorDepreciation !== undefined && { priorDepreciation }),
      // Group membership
      ...(groupId !== undefined && { groupId: groupId || null }),
      ...(splitPct !== undefined && { splitPct }),
      // Financial details
      ...(currentValue !== undefined && { currentValue }),
      ...(loanBalance !== undefined && { loanBalance }),
      ...(bodyMonthlyPayment !== undefined && { monthlyPayment: bodyMonthlyPayment }),
      ...(bodyInterestRate !== undefined && { interestRate: bodyInterestRate }),
      ...(loanTermMonths !== undefined && { loanTermMonths }),
      ...(loanStartDate !== undefined && { loanStartDate: loanStartDate ? new Date(loanStartDate) : null }),
      ...(monthlyPropertyTax !== undefined && { monthlyPropertyTax }),
      ...(monthlyInsurance !== undefined && { monthlyInsurance }),
      ...(monthlyHOA !== undefined && { monthlyHOA }),
      ...(monthlyPMI !== undefined && { monthlyPMI }),
      ...(appreciationRate !== undefined && { appreciationRate: appreciationRate != null ? parseFloat(appreciationRate) : 0.03 }),
      ...(monthlyRentalIncome !== undefined && { monthlyRentalIncome: monthlyRentalIncome != null ? parseFloat(monthlyRentalIncome) : null }),
    },
    include: { group: { select: { id: true, name: true } } },
  })

  // Sync Property → Debt when financial fields are present
  const hasFinancialUpdate = loanBalance !== undefined || bodyMonthlyPayment !== undefined || bodyInterestRate !== undefined
  if (hasFinancialUpdate) {
    await syncPropertyToDebt(id, session.userId, updated.name, {
      loanBalance: updated.loanBalance,
      interestRate: updated.interestRate,
      monthlyPayment: updated.monthlyPayment,
      monthlyPropertyTax: updated.monthlyPropertyTax,
      monthlyInsurance: updated.monthlyInsurance,
      monthlyPMI: updated.monthlyPMI,
      monthlyHOA: updated.monthlyHOA,
      loanTermMonths: updated.loanTermMonths,
      loanStartDate: updated.loanStartDate,
    })
  }

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await db.property.findFirst({
    where: { id, userId: session.userId },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Null out transactions referencing this property, delete splits and account links, then delete
  await db.$transaction([
    db.transaction.updateMany({
      where: { propertyId: id, userId: session.userId },
      data: { propertyId: null },
    }),
    db.transactionSplit.deleteMany({
      where: { propertyId: id },
    }),
    db.accountPropertyLink.deleteMany({
      where: { propertyId: id },
    }),
    db.splitRule.deleteMany({
      where: { propertyId: id },
    }),
    db.userCategoryMapping.updateMany({
      where: { propertyId: id },
      data: { propertyId: null },
    }),
    db.property.delete({ where: { id } }),
  ])

  return new NextResponse(null, { status: 204 })
}
