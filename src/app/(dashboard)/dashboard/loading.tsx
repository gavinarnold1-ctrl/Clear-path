export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 rounded bg-mist" />
        <div className="h-9 w-32 rounded-button bg-mist" />
      </div>

      {/* True Remaining banner skeleton */}
      <div className="rounded-card border border-mist bg-frost p-6">
        <div className="h-5 w-36 rounded bg-mist" />
        <div className="mt-2 h-10 w-48 rounded bg-mist" />
        <div className="mt-3 h-3 w-full rounded-bar bg-mist" />
      </div>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-card border border-mist bg-frost p-4">
            <div className="h-3 w-20 rounded bg-mist" />
            <div className="mt-2 h-7 w-28 rounded bg-mist" />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="rounded-card border border-mist bg-frost p-6">
        <div className="h-5 w-32 rounded bg-mist" />
        <div className="mt-4 h-64 rounded bg-mist/50" />
      </div>

      {/* Budget pulse skeleton */}
      <div className="rounded-card border border-mist bg-frost p-6">
        <div className="h-5 w-28 rounded bg-mist" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-4 w-32 rounded bg-mist" />
              <div className="h-3 flex-1 rounded-bar bg-mist" />
              <div className="h-4 w-16 rounded bg-mist" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
