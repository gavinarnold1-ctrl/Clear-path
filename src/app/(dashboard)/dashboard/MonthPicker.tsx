'use client'

import { useRouter } from 'next/navigation'

export default function MonthPicker({ currentMonth }: { currentMonth: string }) {
  const router = useRouter()

  return (
    <input
      type="month"
      value={currentMonth}
      onChange={(e) => {
        const value = e.target.value
        if (value) {
          router.push(`/dashboard?month=${value}`)
        } else {
          router.push('/dashboard')
        }
      }}
      className="input text-sm"
    />
  )
}
