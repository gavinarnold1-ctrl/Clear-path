export default function BudgetsLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 rounded bg-mist" />
        <div className="h-9 w-32 rounded-button bg-mist" />
      </div>

      {/* True Remaining banner skeleton */}
      <div className="rounded-card border border-mist bg-frost p-5">
        <div className="h-4 w-36 rounded bg-mist" />
        <div className="mt-2 h-8 w-44 rounded bg-mist" />
        <div className="mt-3 h-3 w-full rounded-bar bg-mist" />
      </div>

      {/* Tier section skeletons */}
      {Array.from({ length: 3 }).map((_, t) => (
        <div key={t} className="space-y-3">
          <div className="h-6 w-32 rounded bg-mist" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-card border border-mist bg-frost p-4">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-28 rounded bg-mist" />
                  <div className="h-4 w-16 rounded bg-mist" />
                </div>
                <div className="mt-3 h-3 w-full rounded-bar bg-mist" />
                <div className="mt-2 h-3 w-24 rounded bg-mist" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
