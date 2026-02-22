'use client'

import { useRouter, usePathname } from 'next/navigation'

export default function MonthPicker({ currentMonth }: { currentMonth: string }) {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <input
      type="month"
      value={currentMonth}
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
