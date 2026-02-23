'use client'

import { useRouter, usePathname } from 'next/navigation'

export default function MonthPicker({ currentMonth }: { currentMonth: string }) {
  const router = useRouter()
  const pathname = usePathname()

  // Prevent navigating to future months
  const now = new Date()
  const maxMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  return (
    <input
      type="month"
      value={currentMonth}
      max={maxMonth}
      onChange={(e) => {
        const value = e.target.value
        if (value) {
          router.push(`${pathname}?month=${value}`)
        } else {
          router.push(pathname)
        }
      }}
      className="input text-sm"
    />
  )
}
