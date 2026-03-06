'use client'

import { useState } from 'react'
import { ConfirmModal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

export default function ReimportPage() {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  async function handleReimport() {
    setConfirmOpen(false)
    setStatus('running')
    setResult(null)

    try {
      const res = await fetch('/api/reimport', { method: 'POST' })
      const data = await res.json()

      if (res.ok) {
        setStatus('done')
        setResult(data)
      } else {
        setStatus('error')
        setResult(data)
      }
    } catch (err) {
      setStatus('error')
      setResult({ error: String(err) })
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 font-display text-2xl font-bold text-midnight">
        Data Reimport
      </h1>
      <p className="mb-6 text-stone">
        This will nuke all existing data and reimport 4,824 transactions from the source CSV
        with proper category groups, classification, and household member mapping.
      </p>

      <Button
        variant="danger"
        onClick={() => setConfirmOpen(true)}
        loading={status === 'running'}
        loadingText="Reimporting... (this takes ~30s)"
      >
        Nuke &amp; Reimport
      </Button>

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleReimport}
        title="Nuke & Reimport?"
        description="This will DELETE all your transactions, accounts, categories, budgets, and debts, then reimport from the CSV. Are you sure?"
        confirmLabel="Yes, reimport"
        variant="danger"
      />

      {status === 'done' && result && (
        <div className="mt-6 rounded-card border border-pine/30 bg-frost p-4">
          <h2 className="mb-2 font-semibold text-pine">Import Complete</h2>
          <pre className="max-h-96 overflow-auto text-xs text-midnight">
            {JSON.stringify((result as { summary?: unknown }).summary, null, 2)}
          </pre>
        </div>
      )}

      {status === 'error' && result && (
        <div className="mt-6 rounded-card border border-ember/30 bg-ember/10 p-4">
          <h2 className="mb-2 font-semibold text-ember">Error</h2>
          <pre className="max-h-96 overflow-auto text-xs text-midnight">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
