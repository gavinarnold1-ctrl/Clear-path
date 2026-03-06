'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePlaidLink } from 'react-plaid-link'

export default function GetStarted() {
  const router = useRouter()

  // Plaid Link state
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [plaidLoading, setPlaidLoading] = useState(false)
  const [plaidMessage, setPlaidMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function fetchLinkToken() {
    setPlaidLoading(true)
    setPlaidMessage(null)
    setError(null)
    try {
      const res = await fetch('/api/plaid/create-link-token', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to create link token')
      const data = await res.json()
      setLinkToken(data.link_token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start bank connection')
      setPlaidLoading(false)
    }
  }

  const onPlaidSuccess = useCallback(async (publicToken: string) => {
    setPlaidLoading(true)
    setPlaidMessage('Connecting accounts...')
    try {
      const exchangeRes = await fetch('/api/plaid/exchange-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_token: publicToken }),
      })
      if (!exchangeRes.ok) throw new Error('Failed to connect bank')
      const exchangeData = await exchangeRes.json()
      const accountCount = exchangeData.accounts?.length ?? 0

      setPlaidMessage('Syncing transactions...')
      const syncRes = await fetch('/api/plaid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const syncData = syncRes.ok ? await syncRes.json() : { added: 0 }

      setPlaidMessage(
        `Connected ${accountCount} account${accountCount !== 1 ? 's' : ''}, imported ${syncData.added} transaction${syncData.added !== 1 ? 's' : ''}`
      )
      setTimeout(() => router.refresh(), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect bank')
    } finally {
      setPlaidLoading(false)
      setLinkToken(null)
    }
  }, [router])

  const onPlaidExit = useCallback(() => {
    setPlaidLoading(false)
    setLinkToken(null)
  }, [])

  const { open: openPlaidLink, ready: plaidReady } = usePlaidLink({
    token: linkToken,
    onSuccess: onPlaidSuccess,
    onExit: onPlaidExit,
  })

  useEffect(() => {
    if (linkToken && plaidReady) {
      openPlaidLink()
    }
  }, [linkToken, plaidReady, openPlaidLink])

  return (
    <div className="mx-auto max-w-3xl py-8">
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl font-medium text-fjord">
          Welcome to oversikt
        </h1>
        <p className="mt-2 text-base text-stone">
          Get a clear view of your finances. Choose how to get started.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-ember/30 bg-ember/10 px-4 py-2 text-sm text-ember">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-medium underline">dismiss</button>
        </div>
      )}

      {plaidMessage && (
        <div className="mb-6 rounded-lg border border-pine/30 bg-pine/10 px-4 py-2 text-sm text-fjord">
          {plaidMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Card 1: Connect your bank (primary — larger, emphasized) */}
        <button
          type="button"
          onClick={fetchLinkToken}
          disabled={plaidLoading}
          className="card flex flex-col items-center border-2 border-pine/30 bg-pine/5 p-6 text-center transition hover:shadow-md disabled:opacity-60 sm:col-span-3 sm:flex-row sm:gap-6 sm:p-8 sm:text-left"
        >
          <div className="mb-4 flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-frost sm:mb-0">
            <svg className="h-8 w-8 text-fjord" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" />
            </svg>
          </div>
          <div className="flex flex-1 flex-col items-center sm:items-start">
            <h2 className="mb-1 text-lg font-semibold text-fjord">Connect your bank</h2>
            <p className="mb-3 text-sm text-stone">
              Automatically import transactions and balances
            </p>
          </div>
          <span className="shrink-0 inline-block rounded-button bg-pine px-6 py-2.5 text-sm font-medium text-snow">
            {plaidLoading ? 'Connecting...' : 'Connect with Plaid'}
          </span>
        </button>

        {/* Card 2: Import a CSV (secondary) */}
        <button
          type="button"
          onClick={() => router.push('/transactions/import')}
          className="card flex flex-col items-center border-mist p-6 text-center transition hover:shadow-md sm:p-8"
        >
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-frost">
            <svg className="h-7 w-7 text-fjord" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <h2 className="mb-1 text-lg font-semibold text-fjord">Import a CSV</h2>
          <p className="mb-4 text-sm text-stone">
            Upload a spreadsheet of past transactions
          </p>
          <span className="mt-auto inline-block rounded-button border border-mist px-5 py-2 text-sm font-medium text-fjord">
            Upload CSV
          </span>
        </button>

        {/* Card 3: Start from scratch (tertiary) */}
        <button
          type="button"
          onClick={() => router.push('/accounts')}
          className="card flex flex-col items-center border-mist p-6 text-center transition hover:shadow-md sm:col-span-2 sm:p-8"
        >
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-frost">
            <svg className="h-7 w-7 text-fjord" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
            </svg>
          </div>
          <h2 className="mb-1 text-lg font-semibold text-fjord">Start from scratch</h2>
          <p className="mb-4 text-sm text-stone">
            Add accounts and transactions manually
          </p>
          <span className="mt-auto inline-block rounded-button border border-mist px-5 py-2 text-sm font-medium text-fjord">
            Get started
          </span>
        </button>
      </div>
    </div>
  )
}
