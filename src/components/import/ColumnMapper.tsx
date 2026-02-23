'use client'

import type { AppField } from '@/lib/column-mapping'

interface ColumnMappingData {
  csvColumn: string
  appField: AppField
  confidence: number
  sampleValues: string[]
}

interface ColumnMapperProps {
  mappings: ColumnMappingData[]
  onMappingsChange: (mappings: ColumnMappingData[]) => void
}

const FIELD_OPTIONS: { value: AppField; label: string }[] = [
  { value: 'date', label: 'Date' },
  { value: 'merchant', label: 'Merchant' },
  { value: 'amount', label: 'Amount' },
  { value: 'category', label: 'Category' },
  { value: 'account', label: 'Account' },
  { value: 'ignore', label: 'Ignore' },
]

function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence >= 0.9) {
    return <span className="rounded-full bg-pine/10 px-1.5 py-0.5 text-xs text-green-700">Auto</span>
  }
  if (confidence >= 0.7) {
    return <span className="rounded-full bg-birch/20 px-1.5 py-0.5 text-xs text-amber-700">Maybe</span>
  }
  return null
}

export default function ColumnMapper({ mappings, onMappingsChange }: ColumnMapperProps) {
  function handleFieldChange(index: number, appField: AppField) {
    const updated = [...mappings]
    updated[index] = { ...updated[index], appField, confidence: 1.0 }
    onMappingsChange(updated)
  }

  return (
    <div className="card overflow-hidden p-0">
      <table className="w-full text-sm">
        <thead className="border-b border-mist bg-snow">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-stone">CSV Column</th>
            <th className="px-4 py-3 text-left font-medium text-stone">Sample Values</th>
            <th className="px-4 py-3 text-left font-medium text-stone">Maps To</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-mist">
          {mappings.map((mapping, i) => (
            <tr key={mapping.csvColumn} className="hover:bg-snow">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-fjord">{mapping.csvColumn}</span>
                  <ConfidenceBadge confidence={mapping.confidence} />
                </div>
              </td>
              <td className="px-4 py-3 text-stone">
                <div className="max-w-xs truncate text-xs">
                  {mapping.sampleValues.filter(Boolean).slice(0, 3).join(', ')}
                </div>
              </td>
              <td className="px-4 py-3">
                <select
                  value={mapping.appField}
                  onChange={(e) => handleFieldChange(i, e.target.value as AppField)}
                  className="input w-36"
                >
                  {FIELD_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
