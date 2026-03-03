'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const VALID_TYPES = [
  { value: 'PERSONAL', label: 'Personal Home' },
  { value: 'RENTAL', label: 'Rental Property' },
  { value: 'BUSINESS', label: 'Business' },
] as const

export default function AddPropertyInline() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [type, setType] = useState<string>('PERSONAL')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), type }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to create property.')
        return
      }
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card py-8 text-center">
      <h3 className="text-lg font-medium text-fjord mb-2">Track Your Properties</h3>
      <p className="text-sm text-stone mb-4 max-w-md mx-auto">
        Add your rental properties, primary home, or business to track income, expenses,
        tax deductions, and mortgage breakdown automatically.
      </p>
      <form onSubmit={handleSubmit} className="mx-auto max-w-sm space-y-3">
        {error && (
          <p className="rounded-lg bg-ember/10 p-2 text-xs text-ember">{error}</p>
        )}
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input w-full text-sm"
          placeholder="Property name (e.g. 123 Main St)"
          required
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="input w-full text-sm"
        >
          {VALID_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="btn-primary w-full text-sm disabled:opacity-50"
        >
          {saving ? 'Adding...' : 'Add Property'}
        </button>
      </form>
    </div>
  )
}
