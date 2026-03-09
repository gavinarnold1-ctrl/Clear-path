import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton'

export default function TransactionsLoading() {
  return (
    <SkeletonGroup>
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <div className="flex gap-3">
          <Skeleton className="h-10 w-28 rounded-button" />
          <Skeleton className="h-10 w-36 rounded-button" />
        </div>
      </div>

      {/* Search bar skeleton */}
      <Skeleton className="mb-3 h-10 rounded-button" />

      {/* Table skeleton */}
      <div className="overflow-hidden rounded-card border border-mist bg-frost p-0">
        <div className="border-b border-mist bg-snow px-4 py-3">
          <div className="flex gap-8">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="hidden h-4 w-16 md:block" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-mist/50 px-4 py-3">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="hidden h-4 w-20 md:block" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        ))}
        <div className="flex items-center justify-between px-4 py-2">
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    </SkeletonGroup>
  )
}
