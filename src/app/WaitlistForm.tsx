'use client'

import { useState } from 'react'

export function WaitlistForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'duplicate' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    setStatus('loading')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()

      if (res.status === 201) {
        setStatus('success')
        setMessage(data.message)
        setEmail('')
      } else if (res.status === 409) {
        setStatus('duplicate')
        setMessage(data.message)
      } else {
        setStatus('error')
        setMessage(data.error || 'Something went wrong.')
      }
    } catch {
      setStatus('error')
      setMessage('Something went wrong. Please try again.')
    }
  }

  if (status === 'success') {
    return (
      <div className="rounded-card border border-pine/30 bg-pine/10 px-6 py-4">
        <p className="font-medium text-snow">{message}</p>
      </div>
    )
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          className="flex-1 rounded-button border border-snow/20 bg-snow/10 px-4 py-3 text-sm text-snow placeholder:text-snow/40 focus-visible:border-snow/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snow/20"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="rounded-button bg-snow px-6 py-3 text-sm font-medium text-fjord hover:bg-frost disabled:opacity-50"
        >
          {status === 'loading' ? 'Joining…' : 'Notify me'}
        </button>
      </form>

      {(status === 'duplicate' || status === 'error') && (
        <p className={`mt-3 text-sm ${status === 'duplicate' ? 'text-lichen' : 'text-ember'}`}>
          {message}
        </p>
      )}
    </div>
  )
}
