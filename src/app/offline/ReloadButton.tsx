'use client'

export default function ReloadButton() {
  return (
    <button
      onClick={() => window.location.reload()}
      className="btn-primary mt-8 px-8 py-2.5 text-sm"
    >
      Try again
    </button>
  )
}
