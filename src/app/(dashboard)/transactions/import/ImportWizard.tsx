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
  const [isMonarch, setIsMonarch] = useState(false)

  // State from transform
  const [previewTransactions, setPreviewTransactions] = useState<ParsedTransaction[]>([])
  const [previewErrors, setPreviewErrors] = useState<{ row: number; message: string }[]>([])

  // Monarch preview data (raw rows for direct display)
  const [monarchPreviewRows, setMonarchPreviewRows] = useState<string[][]>([])

  // Import config
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [skipDuplicates, setSkipDuplicates] = useState(true)

  // Result
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

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
      setTotalRows(data.totalRows)
      setCsvText(data.csvText)

      if (data.isMonarch) {
        setIsMonarch(true)
        setMonarchPreviewRows(data.sampleRows)
        setStep('preview') // Skip column mapping for Monarch
      } else {
        setIsMonarch(false)
        setMappings(data.mappings)
        setStep('map')
      }
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
      const body: Record<string, unknown> = {
        csvText,
        accountId: accountId || undefined,
        skipDuplicates,
        isMonarch,
      }

      if (!isMonarch) {
        const mapping: Record<string, string> = {}
        mappings.forEach((m) => {
          mapping[m.csvColumn] = m.appField
        })
        body.mapping = mapping
      }

      const res = await fetch('/api/transactions/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

  const previewCount = isMonarch ? totalRows : previewTransactions.length
  const activeSteps = isMonarch
    ? (['upload', 'preview', 'done'] as const)
    : (['upload', 'map', 'preview', 'done'] as const)

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {activeSteps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <span className="text-gray-300">&rarr;</span>}
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
        {isMonarch && step !== 'upload' && (
          <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            Monarch Money format detected
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 'upload' && <CsvUploader onUpload={handleUpload} loading={loading} />}

      {/* Step 2: Map columns (non-Monarch only) */}
      {step === 'map' && !isMonarch && (
        <>
          <ColumnMapper mappings={mappings} onMappingsChange={setMappings} />

          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label htmlFor="account" className="mb-1 block text-sm font-medium text-gray-700">
                Import into account
              </label>
              <select
                id="account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="input"
              >
                <option value="">No account</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
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
          {isMonarch ? (
            // Monarch preview: show raw sample rows
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4 rounded-lg bg-gray-50 p-4 text-sm">
                <span className="text-gray-600">
                  <span className="font-semibold text-gray-900">{totalRows}</span> transactions
                  to import
                </span>
              </div>
              {monarchPreviewRows.length > 0 && (
                <div className="card overflow-hidden p-0">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-100 bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">Merchant</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">Category</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-500">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {monarchPreviewRows.slice(0, 10).map((row, i) => {
                        const dateIdx = headers.findIndex((h) => h.toLowerCase() === 'date')
                        const merchantIdx = headers.findIndex((h) => h.toLowerCase() === 'merchant')
                        const categoryIdx = headers.findIndex((h) => h.toLowerCase() === 'category')
                        const amountIdx = headers.findIndex((h) => h.toLowerCase() === 'amount')
                        const amt = parseFloat(row[amountIdx]?.replace(/[$,]/g, '') || '0')
                        return (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-500">{row[dateIdx]}</td>
                            <td className="px-4 py-3 font-medium text-gray-900">{row[merchantIdx]}</td>
                            <td className="px-4 py-3 text-gray-500">{row[categoryIdx] || '—'}</td>
                            <td className={`px-4 py-3 text-right font-semibold ${amt < 0 ? 'text-expense' : 'text-income'}`}>
                              {amt < 0 ? '−' : '+'}${Math.abs(amt).toFixed(2)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {totalRows > 10 && (
                    <p className="border-t border-gray-100 px-4 py-2 text-center text-xs text-gray-400">
                      Showing 10 of {totalRows} transactions
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <ImportPreview
              transactions={previewTransactions}
              errors={previewErrors}
              totalRows={totalRows}
            />
          )}

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
                onClick={() => setStep(isMonarch ? 'upload' : 'map')}
                className="btn-secondary"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={loading || previewCount === 0}
                className="btn-primary disabled:cursor-not-allowed"
              >
                {loading
                  ? 'Importing...'
                  : `Import ${previewCount} transaction${previewCount !== 1 ? 's' : ''}`}
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
