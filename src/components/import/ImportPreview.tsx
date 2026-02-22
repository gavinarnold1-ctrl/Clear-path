'use client'

import { formatCurrency } from '@/lib/utils'
import type { ParsedTransaction } from '@/lib/csv-parser'

interface ImportPreviewProps {
  transactions: ParsedTransaction[]
  errors: { row: number; message: string }[]
  totalRows: number
}

export default function ImportPreview({ transactions, errors, totalRows }: ImportPreviewProps) {
  const preview = transactions.slice(0, 10)
  const skippedOrErrored = totalRows - transactions.length
  const hasAccount = transactions.some((tx) => tx.account)

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap gap-4 rounded-lg bg-gray-50 p-4 text-sm">
        <span className="text-gray-600">
          <span className="font-semibold text-gray-900">{transactions.length}</span> transactions
          to import
        </span>
        {skippedOrErrored > 0 && (
          <span className="text-gray-600">
            <span className="font-semibold text-amber-600">{skippedOrErrored}</span> rows skipped
          </span>
        )}
        {errors.length > 0 && (
          <span className="text-gray-600">
            <span className="font-semibold text-expense">{errors.length}</span> errors
          </span>
        )}
      </div>

      {/* Preview table */}
      {preview.length > 0 && (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Description</th>
                {hasAccount && (
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Account</th>
                )}
                <th className="px-4 py-3 text-left font-medium text-gray-500">Category</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {preview.map((tx, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{tx.date}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{tx.description}</td>
                  {hasAccount && (
                    <td className="px-4 py-3 text-gray-500">{tx.account ?? '—'}</td>
                  )}
                  <td className="px-4 py-3 text-gray-500">{tx.category ?? '—'}</td>
                  <td
                    className={`px-4 py-3 text-right font-semibold ${
                      tx.type === 'EXPENSE' ? 'text-expense' : 'text-income'
                    }`}
                  >
                    {tx.type === 'EXPENSE' ? '−' : '+'}
                    {formatCurrency(tx.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {transactions.length > 10 && (
            <p className="border-t border-gray-100 px-4 py-2 text-center text-xs text-gray-400">
              Showing 10 of {transactions.length} transactions
            </p>
          )}
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="mb-2 text-sm font-medium text-red-700">Parse errors</p>
          <ul className="space-y-1 text-xs text-red-600">
            {errors.slice(0, 10).map((err, i) => (
              <li key={i}>
                Row {err.row}: {err.message}
              </li>
            ))}
            {errors.length > 10 && (
              <li className="text-red-400">...and {errors.length - 10} more errors</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
