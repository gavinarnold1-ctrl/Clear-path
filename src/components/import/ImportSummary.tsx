import Link from 'next/link'

interface ImportSummaryProps {
  imported: number
  duplicates: number
  errors: { row: number; message: string }[]
  total: number
}

export default function ImportSummary({ imported, duplicates, errors, total }: ImportSummaryProps) {
  return (
    <div className="card space-y-4 text-center">
      <div>
        <p className="text-3xl font-bold text-income">{imported}</p>
        <p className="text-sm text-stone">transactions imported</p>
      </div>

      <div className="flex justify-center gap-6 text-sm">
        {duplicates > 0 && (
          <div>
            <p className="font-semibold text-birch">{duplicates}</p>
            <p className="text-xs text-stone">duplicates skipped</p>
          </div>
        )}
        {errors.length > 0 && (
          <div>
            <p className="font-semibold text-expense">{errors.length}</p>
            <p className="text-xs text-stone">errors</p>
          </div>
        )}
        <div>
          <p className="font-semibold text-fjord">{total}</p>
          <p className="text-xs text-stone">total rows</p>
        </div>
      </div>

      <div className="flex justify-center gap-3 pt-2">
        <Link href="/transactions" className="btn-primary">
          View transactions
        </Link>
        <Link href="/transactions/import" className="btn-secondary">
          Import another
        </Link>
      </div>
    </div>
  )
}
