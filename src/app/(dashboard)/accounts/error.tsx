'use client'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <h2 className="text-lg font-medium text-midnight">Something went wrong</h2>
      <p className="text-sm text-stone max-w-md text-center">
        We hit an unexpected error loading this page. Try refreshing, or contact support if the issue persists.
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-fjord text-white rounded-button text-sm hover:bg-fjord/90"
      >
        Try again
      </button>
    </div>
  )
}
