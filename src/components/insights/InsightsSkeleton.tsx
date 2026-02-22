export default function InsightsSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Efficiency score skeleton */}
      <div className="card flex flex-col items-center gap-4">
        <div className="h-5 w-40 rounded bg-gray-200" />
        <div className="h-36 w-36 rounded-full bg-gray-100" />
        <div className="flex w-full justify-around border-t border-gray-100 pt-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="h-6 w-8 rounded bg-gray-200" />
              <div className="h-3 w-14 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>

      {/* Highlight stat skeleton */}
      <div className="card flex items-center justify-between">
        <div>
          <div className="h-4 w-32 rounded bg-gray-200" />
          <div className="mt-2 h-8 w-24 rounded bg-gray-200" />
        </div>
        <div className="h-4 w-48 rounded bg-gray-100" />
      </div>

      {/* Insight cards skeleton */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="card border-l-4 border-l-gray-200">
          <div className="mb-2 flex gap-2">
            <div className="h-5 w-5 rounded bg-gray-200" />
            <div className="h-5 w-12 rounded-full bg-gray-200" />
            <div className="h-5 w-20 rounded-full bg-gray-100" />
          </div>
          <div className="h-4 w-3/4 rounded bg-gray-200" />
          <div className="mt-2 h-3 w-full rounded bg-gray-100" />
          <div className="mt-1 h-3 w-2/3 rounded bg-gray-100" />
        </div>
      ))}
    </div>
  )
}
