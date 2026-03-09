'use client'

import dynamic from 'next/dynamic'

const MonthlyChart = dynamic(() => import('@/components/dashboard/MonthlyChart'), {
  ssr: false,
  loading: () => (
    <div className="h-64 animate-pulse rounded-card bg-mist/30" />
  ),
})

export default MonthlyChart
