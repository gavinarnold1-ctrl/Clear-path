'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { trackPageViewed } from '@/lib/analytics'

export function PageViewTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (pathname) {
      trackPageViewed(pathname, document.title)
    }
  }, [pathname, searchParams])

  return null
}
