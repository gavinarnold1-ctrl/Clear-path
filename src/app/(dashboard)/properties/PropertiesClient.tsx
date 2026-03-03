'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { TaxSummary } from '@/lib/engines/tax'

interface PropertyCardData {
  id: string
  name: string
  type: string
  address: string
  taxSchedule: string
  income: number
  expenses: number
  depreciation: number
  net: number
  transactionCount: number
  // Financial details
  currentValue?: number | null
  loanBalance?: number | null
  monthlyPayment?: number | null
  interestRate?: number | null
  loanTermMonths?: number | null
  loanStartDate?: string | null
  monthlyPropertyTax?: number | null
  monthlyInsurance?: number | null
  monthlyHOA?: number | null
  monthlyPMI?: number | null
}

interface Props {
  properties: PropertyCardData[]
  totalRentalNet: number
  totalBusinessNet: number
  totalDepreciation: number
  taxSummary: TaxSummary
  monthParam: string
  monthLabel: string
  initialTab: string
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n)
}

function scheduleLabel(s: string): string {
  switch (s) {
    case 'SCHEDULE_A':
      return 'Schedule A'
    case 'SCHEDULE_E':
      return 'Schedule E'
    case 'SCHEDULE_C':
      return 'Schedule C'
    default:
      return s
  }
}

function typeLabel(t: string): string {
  switch (t) {
    case 'PERSONAL':
      return 'Personal'
    case 'RENTAL':
      return 'Rental'
    case 'BUSINESS':
      return 'Business'
    default:
      return t
  }
}

export default function PropertiesClient({
  properties,
  totalRentalNet,
  totalBusinessNet,
  totalDepreciation,
  taxSummary,
  monthParam,
  monthLabel,
  initialTab,
}: Props) {
  const [tab, setTab] = useState<'dashboard' | 'tax'>(
    initialTab === 'tax' ? 'tax' : 'dashboard',
  )

  return (
    <div>
      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-button bg-frost p-1">
        <button
          onClick={() => setTab('dashboard')}
          className={`flex-1 rounded-button px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'dashboard'
              ? 'bg-white text-fjord shadow-sm'
              : 'text-stone hover:text-fjord'
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setTab('tax')}
          className={`flex-1 rounded-button px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'tax'
              ? 'bg-white text-fjord shadow-sm'
              : 'text-stone hover:text-fjord'
          }`}
        >
          Tax Report
        </button>
      </div>

      {tab === 'dashboard' ? (
        <DashboardView
          properties={properties}
          totalRentalNet={totalRentalNet}
          totalBusinessNet={totalBusinessNet}
          totalDepreciation={totalDepreciation}
          monthParam={monthParam}
        />
      ) : (
        <TaxReportView
          taxSummary={taxSummary}
          monthLabel={monthLabel}
          monthParam={monthParam}
        />
      )}
    </div>
  )
}

function DashboardView({
  properties,
  totalRentalNet,
  totalBusinessNet,
  totalDepreciation,
  monthParam,
}: {
  properties: PropertyCardData[]
  totalRentalNet: number
  totalBusinessNet: number
  totalDepreciation: number
  monthParam: string
}) {
  const [editingFinancials, setEditingFinancials] = useState<string | null>(null)

  return (
    <>
      {/* Entity Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {properties.map((prop) => (
          <div key={prop.id} className="card">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="font-medium text-fjord">
                  {prop.name}{' '}
                  <span className="text-xs text-stone">({typeLabel(prop.type)})</span>
                </h3>
                {prop.address && (
                  <p className="mt-0.5 text-xs text-stone">{prop.address}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingFinancials(editingFinancials === prop.id ? null : prop.id)}
                  className="text-[10px] text-stone hover:text-fjord"
                >
                  {editingFinancials === prop.id ? 'Close' : 'Financials'}
                </button>
                <span className="rounded-badge bg-frost px-2 py-0.5 text-[10px] font-medium text-stone">
                  {scheduleLabel(prop.taxSchedule)}
                </span>
              </div>
            </div>

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-stone">Income</span>
                <span className="font-mono text-income">{formatCurrency(prop.income)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone">Expenses</span>
                <span className="font-mono text-expense">
                  {prop.expenses > 0 ? `-${formatCurrency(prop.expenses)}` : formatCurrency(0)}
                </span>
              </div>
              {prop.depreciation > 0 && (
                <div className="flex justify-between">
                  <span className="text-stone">Depreciation</span>
                  <span className="font-mono text-stone">
                    -{formatCurrency(prop.depreciation)}
                  </span>
                </div>
              )}
              <div className="border-t border-mist pt-1.5 flex justify-between font-medium">
                <span className="text-fjord">Net</span>
                <span
                  className={`font-mono ${prop.net >= 0 ? 'text-income' : 'text-expense'}`}
                >
                  {formatCurrency(prop.net)}
                </span>
              </div>
            </div>

            {/* Tax approximation warning for rental/business properties without financial details */}
            {(prop.taxSchedule === 'SCHEDULE_E' || prop.taxSchedule === 'SCHEDULE_C') &&
              prop.expenses > 0 && !prop.loanBalance && (
                <p className="mt-2 text-[10px] text-stone leading-tight">
                  Tax figures are approximate. Add financial details to enable PITI decomposition for accurate tax reporting.
                </p>
              )}

            {/* Equity display for properties with value and loan data */}
            {prop.currentValue != null && prop.loanBalance != null && prop.currentValue > 0 && (
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-stone">Equity</span>
                <span className="font-mono font-medium text-pine">
                  {formatCurrency(prop.currentValue - prop.loanBalance)}{' '}
                  <span className="text-stone font-normal">
                    ({((1 - prop.loanBalance / prop.currentValue) * 100).toFixed(0)}%)
                  </span>
                </span>
              </div>
            )}

            {/* Financial details form (expandable) */}
            {editingFinancials === prop.id && (
              <PropertyFinancialForm property={prop} onClose={() => setEditingFinancials(null)} />
            )}

            <Link
              href={`/transactions?propertyId=${prop.id}&month=${monthParam}`}
              className="mt-3 block text-xs text-stone hover:text-fjord"
            >
              View Transactions ({prop.transactionCount})
            </Link>
          </div>
        ))}
      </div>

      {/* Summary Row */}
      <div className="mt-6 card">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-stone uppercase tracking-wide">Total Rental Net</p>
            <p
              className={`mt-1 font-display text-lg font-semibold ${
                totalRentalNet >= 0 ? 'text-income' : 'text-expense'
              }`}
            >
              {formatCurrency(totalRentalNet)}
            </p>
            <p className="text-[10px] text-stone">Schedule E</p>
          </div>
          <div>
            <p className="text-xs text-stone uppercase tracking-wide">Total Business Net</p>
            <p
              className={`mt-1 font-display text-lg font-semibold ${
                totalBusinessNet >= 0 ? 'text-income' : 'text-expense'
              }`}
            >
              {formatCurrency(totalBusinessNet)}
            </p>
            <p className="text-[10px] text-stone">Schedule C</p>
          </div>
          <div>
            <p className="text-xs text-stone uppercase tracking-wide">Total Depreciation</p>
            <p className="mt-1 font-display text-lg font-semibold text-stone">
              {formatCurrency(totalDepreciation)}
            </p>
            <p className="text-[10px] text-stone">Non-cash deduction</p>
          </div>
        </div>
      </div>
    </>
  )
}

function TaxReportView({
  taxSummary,
  monthLabel,
  monthParam,
}: {
  taxSummary: TaxSummary
  monthLabel: string
  monthParam: string
}) {
  const hasScheduleE = taxSummary.scheduleE.properties.length > 0
  const hasScheduleC = taxSummary.scheduleC.businesses.length > 0
  const hasScheduleA =
    taxSummary.scheduleA.mortgageInterest > 0 ||
    taxSummary.scheduleA.propertyTax > 0 ||
    taxSummary.scheduleA.otherDeductions.length > 0

  if (!hasScheduleE && !hasScheduleC && !hasScheduleA) {
    return (
      <div className="card text-center py-8">
        <p className="text-stone">
          No tax-relevant transactions found for {monthLabel}.
        </p>
      </div>
    )
  }

  // Build CSV export data
  function exportCsv() {
    const rows: string[][] = [['Schedule', 'Property', 'Category', 'Amount', 'Period']]

    for (const p of taxSummary.scheduleE.properties) {
      rows.push(['Schedule E', p.propertyName, 'Rental Income', String(p.income), monthLabel])
      for (const e of p.expenses) {
        rows.push(['Schedule E', p.propertyName, e.category, String(-e.amount), monthLabel])
      }
      if (p.depreciation > 0) {
        rows.push([
          'Schedule E',
          p.propertyName,
          'Depreciation',
          String(-p.depreciation),
          monthLabel,
        ])
      }
      rows.push(['Schedule E', p.propertyName, 'Net Income', String(p.netIncome), monthLabel])
    }

    for (const b of taxSummary.scheduleC.businesses) {
      rows.push([
        'Schedule C',
        b.businessName,
        'Business Income',
        String(b.income),
        monthLabel,
      ])
      for (const e of b.expenses) {
        rows.push(['Schedule C', b.businessName, e.category, String(-e.amount), monthLabel])
      }
      rows.push([
        'Schedule C',
        b.businessName,
        'Net Income',
        String(b.netIncome),
        monthLabel,
      ])
    }

    if (taxSummary.scheduleA.mortgageInterest > 0) {
      rows.push([
        'Schedule A',
        'Personal',
        'Mortgage Interest',
        String(taxSummary.scheduleA.mortgageInterest),
        monthLabel,
      ])
    }
    if (taxSummary.scheduleA.propertyTax > 0) {
      rows.push([
        'Schedule A',
        'Personal',
        'Property Tax',
        String(taxSummary.scheduleA.propertyTax),
        monthLabel,
      ])
    }
    for (const d of taxSummary.scheduleA.otherDeductions) {
      rows.push(['Schedule A', 'Personal', d.category, String(d.amount), monthLabel])
    }

    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tax-report-${monthParam}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-stone uppercase tracking-wide">
          Tax Report — {monthLabel}
        </h2>
        <button onClick={exportCsv} className="btn-secondary text-xs">
          Export for CPA
        </button>
      </div>

      {/* Tax approximation notice */}
      <div className="rounded-card border border-birch/40 bg-birch/10 px-4 py-3">
        <p className="text-xs font-medium text-fjord">Approximation Notice</p>
        <p className="mt-1 text-[11px] text-stone leading-relaxed">
          Properties with financial details use PITI decomposition to separate mortgage payments into deductible components (interest, taxes, insurance) and non-deductible principal. Properties without financial details show full payment amounts as estimates. Add loan details via the &quot;Financials&quot; button on each property card. Consult your CPA for exact amounts.
        </p>
      </div>

      {/* Schedule E */}
      {hasScheduleE && (
        <section className="card">
          <h3 className="mb-4 text-base font-semibold text-fjord">
            Schedule E — Rental Properties
          </h3>
          {taxSummary.scheduleE.properties.map((p) => (
            <div key={p.propertyId} className="mb-4 last:mb-0">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-medium text-fjord">{p.propertyName}</p>
                <Link
                  href={`/transactions?propertyId=${p.propertyId}&month=${monthParam}`}
                  className="text-xs text-stone hover:text-fjord"
                >
                  View transactions
                </Link>
              </div>

              <div className="mb-2 flex justify-between text-sm">
                <span className="text-stone">Rental Income</span>
                <span className="font-mono text-income">{formatCurrency(p.income)}</span>
              </div>

              {p.expenses.length > 0 && (
                <div className="mb-2 space-y-1">
                  <p className="text-xs font-medium text-stone uppercase tracking-wide">
                    Expenses
                  </p>
                  {p.expenses.map((e) => (
                    <div key={e.category} className="flex justify-between text-sm">
                      <span className="text-stone">{e.category}</span>
                      <span className="font-mono text-expense">
                        -{formatCurrency(e.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {p.depreciation > 0 && (
                <div className="mb-2 flex justify-between text-sm">
                  <span className="text-stone">Depreciation</span>
                  <span className="font-mono text-stone">
                    -{formatCurrency(p.depreciation)}
                  </span>
                </div>
              )}

              <div className="border-t border-mist pt-2 flex justify-between text-sm font-medium">
                <span className="text-fjord">Net Rental Income</span>
                <span
                  className={`font-mono ${p.netIncome >= 0 ? 'text-income' : 'text-expense'}`}
                >
                  {formatCurrency(p.netIncome)}
                </span>
              </div>
            </div>
          ))}

          <div className="mt-4 border-t border-mist pt-3 flex justify-between font-medium">
            <span className="text-fjord">Total Schedule E Net</span>
            <span
              className={`font-mono ${
                taxSummary.scheduleE.totalNetIncome >= 0 ? 'text-income' : 'text-expense'
              }`}
            >
              {formatCurrency(taxSummary.scheduleE.totalNetIncome)}
            </span>
          </div>
        </section>
      )}

      {/* Schedule C */}
      {hasScheduleC && (
        <section className="card">
          <h3 className="mb-4 text-base font-semibold text-fjord">
            Schedule C — Business Income
          </h3>
          {taxSummary.scheduleC.businesses.map((b) => (
            <div key={b.propertyId} className="mb-4 last:mb-0">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-medium text-fjord">{b.businessName}</p>
                <Link
                  href={`/transactions?propertyId=${b.propertyId}&month=${monthParam}`}
                  className="text-xs text-stone hover:text-fjord"
                >
                  View transactions
                </Link>
              </div>

              <div className="mb-2 flex justify-between text-sm">
                <span className="text-stone">Business Income</span>
                <span className="font-mono text-income">{formatCurrency(b.income)}</span>
              </div>

              {b.expenses.length > 0 && (
                <div className="mb-2 space-y-1">
                  <p className="text-xs font-medium text-stone uppercase tracking-wide">
                    Expenses
                  </p>
                  {b.expenses.map((e) => (
                    <div key={e.category} className="flex justify-between text-sm">
                      <span className="text-stone">{e.category}</span>
                      <span className="font-mono text-expense">
                        -{formatCurrency(e.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-mist pt-2 flex justify-between text-sm font-medium">
                <span className="text-fjord">Net Business Income</span>
                <span
                  className={`font-mono ${b.netIncome >= 0 ? 'text-income' : 'text-expense'}`}
                >
                  {formatCurrency(b.netIncome)}
                </span>
              </div>
            </div>
          ))}

          <div className="mt-4 border-t border-mist pt-3 flex justify-between font-medium">
            <span className="text-fjord">Total Schedule C Net</span>
            <span
              className={`font-mono ${
                taxSummary.scheduleC.totalNetIncome >= 0 ? 'text-income' : 'text-expense'
              }`}
            >
              {formatCurrency(taxSummary.scheduleC.totalNetIncome)}
            </span>
          </div>
        </section>
      )}

      {/* Schedule A */}
      {hasScheduleA && (
        <section className="card">
          <h3 className="mb-4 text-base font-semibold text-fjord">
            Schedule A — Personal Deductions
          </h3>
          <div className="space-y-1.5 text-sm">
            {taxSummary.scheduleA.mortgageInterest > 0 && (
              <div className="flex justify-between">
                <span className="text-stone">Mortgage Interest (Line 8a)</span>
                <span className="font-mono text-fjord">
                  {formatCurrency(taxSummary.scheduleA.mortgageInterest)}
                </span>
              </div>
            )}
            {taxSummary.scheduleA.propertyTax > 0 && (
              <div className="flex justify-between">
                <span className="text-stone">Property Tax (Line 5b)</span>
                <span className="font-mono text-fjord">
                  {formatCurrency(taxSummary.scheduleA.propertyTax)}
                </span>
              </div>
            )}
            {taxSummary.scheduleA.otherDeductions.map((d) => (
              <div key={d.category} className="flex justify-between">
                <span className="text-stone">{d.category}</span>
                <span className="font-mono text-fjord">{formatCurrency(d.amount)}</span>
              </div>
            ))}
            <div className="border-t border-mist pt-2 flex justify-between font-medium">
              <span className="text-fjord">Total Schedule A</span>
              <span className="font-mono text-fjord">
                {formatCurrency(taxSummary.scheduleA.total)}
              </span>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

function PropertyFinancialForm({
  property,
  onClose,
}: {
  property: PropertyCardData
  onClose: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [currentValue, setCurrentValue] = useState(property.currentValue?.toString() ?? '')
  const [loanBalance, setLoanBalance] = useState(property.loanBalance?.toString() ?? '')
  const [interestRate, setInterestRate] = useState(
    property.interestRate != null ? (property.interestRate * 100).toString() : '',
  )
  const [loanTermMonths, setLoanTermMonths] = useState(property.loanTermMonths?.toString() ?? '')
  const [monthlyPayment, setMonthlyPayment] = useState(property.monthlyPayment?.toString() ?? '')
  const [monthlyPropertyTax, setMonthlyPropertyTax] = useState(
    property.monthlyPropertyTax?.toString() ?? '',
  )
  const [monthlyInsurance, setMonthlyInsurance] = useState(
    property.monthlyInsurance?.toString() ?? '',
  )
  const [monthlyHOA, setMonthlyHOA] = useState(property.monthlyHOA?.toString() ?? '')
  const [monthlyPMI, setMonthlyPMI] = useState(property.monthlyPMI?.toString() ?? '')

  // Compute P&I from current form values
  const bal = parseFloat(loanBalance) || 0
  const rate = (parseFloat(interestRate) || 0) / 100
  const pmt = parseFloat(monthlyPayment) || 0
  const escrow =
    (parseFloat(monthlyPropertyTax) || 0) +
    (parseFloat(monthlyInsurance) || 0) +
    (parseFloat(monthlyHOA) || 0) +
    (parseFloat(monthlyPMI) || 0)
  const piPayment = pmt - escrow
  const monthlyInterest = bal * (rate / 12)
  const monthlyPrincipal = Math.max(0, piPayment - monthlyInterest)

  async function handleSave() {
    if (saving) return
    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/properties/${property.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentValue: currentValue ? parseFloat(currentValue) : null,
          loanBalance: loanBalance ? parseFloat(loanBalance) : null,
          interestRate: interestRate ? parseFloat(interestRate) / 100 : null,
          loanTermMonths: loanTermMonths ? parseInt(loanTermMonths, 10) : null,
          monthlyPayment: monthlyPayment ? parseFloat(monthlyPayment) : null,
          monthlyPropertyTax: monthlyPropertyTax ? parseFloat(monthlyPropertyTax) : null,
          monthlyInsurance: monthlyInsurance ? parseFloat(monthlyInsurance) : null,
          monthlyHOA: monthlyHOA ? parseFloat(monthlyHOA) : null,
          monthlyPMI: monthlyPMI ? parseFloat(monthlyPMI) : null,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to save')
      }
      onClose()
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-mist bg-snow p-3">
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-stone">
        Financial Details
      </p>
      {error && (
        <p className="mb-3 rounded-lg bg-ember/10 p-2 text-xs text-ember">{error}</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-0.5 block text-[11px] text-stone">Property Value</label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-xs text-stone">$</span>
            <input type="number" step="0.01" min="0" value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value)}
              className="input py-1.5 pl-5 text-sm" placeholder="e.g. 350,000" />
          </div>
        </div>
        <div>
          <label className="mb-0.5 block text-[11px] text-stone">Loan Balance</label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-xs text-stone">$</span>
            <input type="number" step="0.01" min="0" value={loanBalance}
              onChange={(e) => setLoanBalance(e.target.value)}
              className="input py-1.5 pl-5 text-sm" placeholder="e.g. 280,000" />
          </div>
        </div>
        <div>
          <label className="mb-0.5 block text-[11px] text-stone">Interest Rate (%)</label>
          <input type="number" step="0.01" min="0" max="100" value={interestRate}
            onChange={(e) => setInterestRate(e.target.value)}
            className="input py-1.5 text-sm" placeholder="e.g. 4.85" />
        </div>
        <div>
          <label className="mb-0.5 block text-[11px] text-stone">Term (months)</label>
          <input type="number" min="1" value={loanTermMonths}
            onChange={(e) => setLoanTermMonths(e.target.value)}
            className="input py-1.5 text-sm" placeholder="e.g. 360" />
        </div>
        <div className="col-span-2">
          <label className="mb-0.5 block text-[11px] text-stone">Total Monthly Payment</label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-xs text-stone">$</span>
            <input type="number" step="0.01" min="0" value={monthlyPayment}
              onChange={(e) => setMonthlyPayment(e.target.value)}
              className="input py-1.5 pl-5 text-sm" placeholder="e.g. 2,100" />
          </div>
        </div>
      </div>

      {/* Escrow breakdown */}
      <p className="mb-2 mt-3 text-[11px] font-medium text-stone">Escrow Breakdown</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-0.5 block text-[11px] text-stone">Property Tax</label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-xs text-stone">$</span>
            <input type="number" step="0.01" min="0" value={monthlyPropertyTax}
              onChange={(e) => setMonthlyPropertyTax(e.target.value)}
              className="input py-1.5 pl-5 text-sm" placeholder="e.g. 350" />
          </div>
        </div>
        <div>
          <label className="mb-0.5 block text-[11px] text-stone">Insurance</label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-xs text-stone">$</span>
            <input type="number" step="0.01" min="0" value={monthlyInsurance}
              onChange={(e) => setMonthlyInsurance(e.target.value)}
              className="input py-1.5 pl-5 text-sm" placeholder="e.g. 120" />
          </div>
        </div>
        <div>
          <label className="mb-0.5 block text-[11px] text-stone">HOA</label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-xs text-stone">$</span>
            <input type="number" step="0.01" min="0" value={monthlyHOA}
              onChange={(e) => setMonthlyHOA(e.target.value)}
              className="input py-1.5 pl-5 text-sm" placeholder="e.g. 0" />
          </div>
        </div>
        <div>
          <label className="mb-0.5 block text-[11px] text-stone">PMI</label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-xs text-stone">$</span>
            <input type="number" step="0.01" min="0" value={monthlyPMI}
              onChange={(e) => setMonthlyPMI(e.target.value)}
              className="input py-1.5 pl-5 text-sm" placeholder="e.g. 0" />
          </div>
        </div>
      </div>

      {/* Live P&I display */}
      {pmt > 0 && bal > 0 && rate > 0 && (
        <div className="mt-3 rounded-lg border border-pine/20 bg-pine/5 p-2">
          <p className="mb-1 text-[10px] font-medium text-stone">Computed P&I</p>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-pine font-medium">
              Principal: {formatCurrency(monthlyPrincipal)}
            </span>
            <span className="text-ember font-medium">
              Interest: {formatCurrency(monthlyInterest)}
            </span>
            {escrow > 0 && (
              <span className="text-stone font-medium">
                Escrow: {formatCurrency(escrow)}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <button onClick={handleSave} disabled={saving} className="btn-primary text-xs py-1.5 px-3">
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button onClick={onClose} className="btn-secondary text-xs py-1.5 px-3">
          Cancel
        </button>
      </div>
    </div>
  )
}
