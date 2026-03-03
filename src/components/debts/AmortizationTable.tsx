'use client'

import { formatCurrency } from '@/lib/utils'

interface AmortRow {
  month: number
  payment: number
  principal: number
  interest: number
  endingBalance: number
}

interface Props {
  balance: number
  annualRate: number
  monthlyPIPayment: number
}

function generateSchedule(balance: number, annualRate: number, monthlyPIPayment: number): AmortRow[] {
  const r = annualRate / 12
  const rows: AmortRow[] = []
  let remaining = balance

  for (let month = 1; remaining > 0.005 && month <= 600; month++) {
    const interest = remaining * r
    const principal = Math.min(monthlyPIPayment - interest, remaining)
    if (principal <= 0) break
    remaining = Math.max(0, remaining - principal)
    rows.push({
      month,
      payment: Math.round((interest + principal) * 100) / 100,
      principal: Math.round(principal * 100) / 100,
      interest: Math.round(interest * 100) / 100,
      endingBalance: Math.round(remaining * 100) / 100,
    })
  }

  return rows
}

export default function AmortizationTable({ balance, annualRate, monthlyPIPayment }: Props) {
  const schedule = generateSchedule(balance, annualRate, monthlyPIPayment)
  const displayMonths = schedule.slice(0, 24)

  if (schedule.length === 0) {
    return (
      <p className="mt-3 text-xs text-stone">
        Cannot generate schedule: payment does not cover monthly interest.
      </p>
    )
  }

  return (
    <div className="mt-3 max-h-64 overflow-y-auto rounded border border-mist">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-frost">
          <tr>
            <th className="px-2 py-1 text-left text-stone font-medium">Month</th>
            <th className="px-2 py-1 text-right text-stone font-medium">Payment</th>
            <th className="px-2 py-1 text-right text-stone font-medium">Principal</th>
            <th className="px-2 py-1 text-right text-stone font-medium">Interest</th>
            <th className="px-2 py-1 text-right text-stone font-medium">Balance</th>
          </tr>
        </thead>
        <tbody>
          {displayMonths.map((row) => (
            <tr key={row.month} className={row.month % 2 === 1 ? 'bg-snow' : 'bg-frost/30'}>
              <td className="px-2 py-1 text-fjord">{row.month}</td>
              <td className="px-2 py-1 text-right text-fjord">{formatCurrency(row.payment)}</td>
              <td className="px-2 py-1 text-right text-pine">{formatCurrency(row.principal)}</td>
              <td className="px-2 py-1 text-right text-ember">{formatCurrency(row.interest)}</td>
              <td className="px-2 py-1 text-right text-fjord">{formatCurrency(row.endingBalance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {schedule.length > 24 && (
        <p className="p-2 text-center text-xs text-stone">
          Showing first 24 of {schedule.length} months. Full payoff in {Math.floor(schedule.length / 12)}y {schedule.length % 12}m.
        </p>
      )}
    </div>
  )
}
