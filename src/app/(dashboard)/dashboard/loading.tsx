import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton'

export default function DashboardLoading() {
  return (
    <SkeletonGroup className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-32 rounded-button" />
      </div>

      {/* True Remaining banner skeleton */}
      <div className="rounded-card border border-mist bg-frost p-6">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="mt-2 h-10 w-48" />
        <Skeleton className="mt-3 h-3 w-full rounded-bar" />
      </div>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-card border border-mist bg-frost p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-7 w-28" />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="rounded-card border border-mist bg-frost p-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton variant="card" className="mt-4 h-64" />
      </div>

      {/* Budget pulse skeleton */}
      <div className="rounded-card border border-mist bg-frost p-6">
        <Skeleton className="h-5 w-28" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 flex-1 rounded-bar" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonGroup>
  )
}
