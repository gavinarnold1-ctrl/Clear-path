import type { Metadata } from 'next'
import ReloadButton from './ReloadButton'

export const metadata: Metadata = { title: "You're offline" }

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-snow px-4 text-center">
      <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-card bg-fjord">
        <span className="font-display text-4xl font-semibold text-snow">O</span>
      </div>

      <h1 className="font-display text-3xl font-medium text-fjord">
        You&apos;re offline
      </h1>

      <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-stone">
        Oversikt needs an internet connection to sync your accounts. Your data is
        waiting when you reconnect.
      </p>

      <ReloadButton />
    </div>
  )
}
