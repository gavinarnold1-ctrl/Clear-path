'use client'

import dynamic from 'next/dynamic'

const ForecastTimeline = dynamic(() => import('./ForecastTimeline'), {
  ssr: false,
  loading: () => (
    <div className="h-80 animate-pulse rounded-card bg-mist/30" />
  ),
})

export default ForecastTimeline
