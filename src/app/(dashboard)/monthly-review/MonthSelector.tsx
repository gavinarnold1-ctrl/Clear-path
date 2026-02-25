'use client'

import { useRouter, useSearchParams } from 'next/navigation'

interface Props {
  availableMonths: string[]
  selectedMonth: string
}

export default function MonthSelector({ availableMonths, selectedMonth }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleChange(month: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (month) {
      params.set('month', month)
    } else {
      params.delete('month')
    }
    router.push(`/monthly-review?${params.toString()}`)
  }

  function formatLabel(month: string): string {
    const [y, m] = month.split('-')
    const date = new Date(parseInt(y), parseInt(m) - 1)
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  return (
    <select
      value={selectedMonth}
      onChange={(e) => handleChange(e.target.value)}
      className="input text-sm"
    >
      <option value="">All time</option>
      {availableMonths.map((m) => (
        <option key={m} value={m}>
          {formatLabel(m)}
        </option>
      ))}
    </select>
  )
}
