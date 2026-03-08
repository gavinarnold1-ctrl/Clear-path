import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton'

export default function BudgetsLoading() {
  return (
    <SkeletonGroup className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-32 rounded-button" />
      </div>

      {/* True Remaining banner skeleton */}
      <div className="rounded-card border border-mist bg-frost p-5">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="mt-2 h-8 w-44" />
        <Skeleton className="mt-3 h-3 w-full rounded-bar" />
      </div>

      {/* Tier section skeletons */}
      {Array.from({ length: 3 }).map((_, t) => (
        <div key={t} className="space-y-3">
          <Skeleton className="h-6 w-32" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-card border border-mist bg-frost p-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="mt-3 h-3 w-full rounded-bar" />
                <Skeleton className="mt-2 h-3 w-24" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </SkeletonGroup>
  )
}
