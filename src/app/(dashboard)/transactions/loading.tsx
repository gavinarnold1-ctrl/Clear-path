export default function TransactionsLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 flex items-center justify-between">
        <div className="h-8 w-40 rounded bg-mist" />
        <div className="flex gap-3">
          <div className="h-10 w-28 rounded-button bg-mist" />
          <div className="h-10 w-36 rounded-button bg-mist" />
        </div>
      </div>

      {/* Search bar skeleton */}
      <div className="mb-3 h-10 rounded-button bg-mist" />

      {/* Table skeleton */}
      <div className="rounded-card border border-mist bg-frost p-0 overflow-hidden">
        <div className="border-b border-mist bg-snow px-4 py-3">
          <div className="flex gap-8">
            <div className="h-4 w-12 rounded bg-mist" />
            <div className="h-4 w-20 rounded bg-mist" />
            <div className="h-4 w-16 rounded bg-mist" />
            <div className="hidden h-4 w-16 rounded bg-mist md:block" />
            <div className="ml-auto h-4 w-16 rounded bg-mist" />
          </div>
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-mist/50 px-4 py-3">
            <div className="h-4 w-4 rounded bg-mist" />
            <div className="h-4 w-20 rounded bg-mist" />
            <div className="h-4 w-32 rounded bg-mist" />
            <div className="h-4 w-24 rounded bg-mist" />
            <div className="hidden h-4 w-20 rounded bg-mist md:block" />
            <div className="ml-auto h-4 w-16 rounded bg-mist" />
          </div>
        ))}
        <div className="flex items-center justify-between px-4 py-2">
          <div className="h-3 w-32 rounded bg-mist" />
        </div>
      </div>
    </div>
  )
}
