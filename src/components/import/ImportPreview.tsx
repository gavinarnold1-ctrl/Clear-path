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

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap gap-4 rounded-lg bg-snow p-4 text-sm">
        <span className="text-stone">
          <span className="font-semibold text-fjord">{transactions.length}</span> transactions
          to import
        </span>
        {skippedOrErrored > 0 && (
          <span className="text-stone">
            <span className="font-semibold text-birch">{skippedOrErrored}</span> rows skipped
          </span>
        )}
        {errors.length > 0 && (
          <span className="text-stone">
            <span className="font-semibold text-expense">{errors.length}</span> errors
          </span>
        )}
      </div>

      {/* Preview table */}
      {preview.length > 0 && (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-mist bg-snow">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-stone">Date</th>
                <th className="px-4 py-3 text-left font-medium text-stone">Merchant</th>
                <th className="px-4 py-3 text-left font-medium text-stone">Category</th>
                <th className="px-4 py-3 text-right font-medium text-stone">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist">
              {preview.map((tx, i) => (
                <tr key={i} className="hover:bg-snow">
                  <td className="px-4 py-3 text-stone">{tx.date}</td>
                  <td className="px-4 py-3 font-medium text-fjord">{tx.merchant}</td>
                  <td className="px-4 py-3 text-stone">{tx.category ?? '—'}</td>
                  <td
                    className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${
                      tx.amount < 0 ? 'text-expense' : 'text-income'
                    }`}
                  >
                    {tx.amount < 0 ? '−' : '+'}
                    {formatCurrency(Math.abs(tx.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {transactions.length > 10 && (
            <p className="border-t border-mist px-4 py-2 text-center text-xs text-stone">
              Showing 10 of {transactions.length} transactions
            </p>
          )}
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="rounded-lg border border-ember/30 bg-ember/10 p-4">
          <p className="mb-2 text-sm font-medium text-ember">Parse errors</p>
          <ul className="space-y-1 text-xs text-ember">
            {errors.slice(0, 10).map((err, i) => (
              <li key={i}>
                Row {err.row}: {err.message}
              </li>
            ))}
            {errors.length > 10 && (
              <li className="text-ember/70">...and {errors.length - 10} more errors</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
