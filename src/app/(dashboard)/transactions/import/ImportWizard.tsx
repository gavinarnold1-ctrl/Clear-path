'use client'

import { useState } from 'react'
import CsvUploader from '@/components/import/CsvUploader'
import ColumnMapper from '@/components/import/ColumnMapper'
import ImportPreview from '@/components/import/ImportPreview'
import ImportSummary from '@/components/import/ImportSummary'
import { transformRows, parseCSV } from '@/lib/csv-parser'
import type { AppField } from '@/lib/column-mapping'
import type { ParsedTransaction } from '@/lib/csv-parser'

interface ColumnMappingData {
  csvColumn: string
  appField: AppField
  confidence: number
  sampleValues: string[]
}

interface Account {
  id: string
  name: string
  type: string
}

type Step = 'upload' | 'map' | 'preview' | 'done'

interface ImportResult {
  imported: number
  duplicates: number
  errors: { row: number; message: string }[]
  total: number
}

export default function ImportWizard({ accounts }: { accounts: Account[] }) {
  const [step, setStep] = useState<Step>('upload')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // State from parsing
  const [csvText, setCsvText] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [mappings, setMappings] = useState<ColumnMappingData[]>([])
  const [totalRows, setTotalRows] = useState(0)

  // State from transform
  const [previewTransactions, setPreviewTransactions] = useState<ParsedTransaction[]>([])
  const [previewErrors, setPreviewErrors] = useState<{ row: number; message: string }[]>([])

  // Import config
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [skipDuplicates, setSkipDuplicates] = useState(true)

  // Result
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  const hasAccountColumn = mappings.some((m) => m.appField === 'account')

  async function handleUpload(file: File) {
    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/transactions/import/preview', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to parse CSV')
        return
      }

      const data = await res.json()
      setHeaders(data.headers)
      setMappings(data.mappings)
      setTotalRows(data.totalRows)
      setCsvText(data.csvText)
      setStep('map')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handlePreview() {
    if (!csvText) return
    setError(null)

    const mapping: Record<string, string> = {}
    mappings.forEach((m) => {
      mapping[m.csvColumn] = m.appField
    })

    // Validate: must have at least date and amount mapped
    const hasDate = mappings.some((m) => m.appField === 'date')
    const hasAmount = mappings.some((m) => m.appField === 'amount')
    if (!hasDate || !hasAmount) {
      setError('You must map at least a Date and Amount column')
      return
    }

    const { headers: h, rows } = parseCSV(csvText)
    const result = transformRows(rows, h, mapping)

    setPreviewTransactions(result.transactions)
    setPreviewErrors(result.errors)
    setStep('preview')
  }

  async function handleImport() {
    if (!csvText) return
    setLoading(true)
    setError(null)

    try {
      const mapping: Record<string, string> = {}
      mappings.forEach((m) => {
        mapping[m.csvColumn] = m.appField
      })

      const res = await fetch('/api/transactions/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText, mapping, accountId, skipDuplicates }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to import transactions')
        return
      }

      const data = await res.json()
      setImportResult(data)
      setStep('done')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(['upload', 'map', 'preview', 'done'] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <span className="text-gray-300">→</span>}
            <span
              className={`rounded-full px-3 py-1 font-medium ${
                step === s
                  ? 'bg-brand-100 text-brand-700'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {i + 1}. {s === 'upload' ? 'Upload' : s === 'map' ? 'Map Columns' : s === 'preview' ? 'Preview' : 'Done'}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 'upload' && <CsvUploader onUpload={handleUpload} loading={loading} />}

      {/* Step 2: Map columns */}
      {step === 'map' && (
        <>
          <ColumnMapper mappings={mappings} onMappingsChange={setMappings} />

          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label htmlFor="account" className="mb-1 block text-sm font-medium text-gray-700">
                {hasAccountColumn
                  ? 'Fallback account (for rows that don\u2019t match an existing account)'
                  : 'Import into account'}
              </label>
              <select
                id="account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="input"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              {hasAccountColumn && (
                <p className="mt-1 text-xs text-gray-500">
                  Account column detected — rows will be matched to your accounts by name.
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="btn-secondary"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handlePreview}
                disabled={!accountId}
                className="btn-primary disabled:cursor-not-allowed"
              >
                Preview import
              </button>
            </div>
          </div>
        </>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && (
        <>
          <ImportPreview
            transactions={previewTransactions}
            errors={previewErrors}
            totalRows={totalRows}
          />

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={skipDuplicates}
                onChange={(e) => setSkipDuplicates(e.target.checked)}
                className="rounded border-gray-300"
              />
              Skip duplicate transactions
            </label>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep('map')}
                className="btn-secondary"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={loading || previewTransactions.length === 0}
                className="btn-primary disabled:cursor-not-allowed"
              >
                {loading
                  ? 'Importing...'
                  : `Import ${previewTransactions.length} transaction${previewTransactions.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Step 4: Done */}
      {step === 'done' && importResult && (
        <ImportSummary
          imported={importResult.imported}
          duplicates={importResult.duplicates}
          errors={importResult.errors}
          total={importResult.total}
        />
      )}
    </div>
  )
}
