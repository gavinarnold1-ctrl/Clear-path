export type AppField = 'date' | 'description' | 'amount' | 'category' | 'type' | 'ignore'

// Monarch Money CSV headers (case-insensitive match)
const MONARCH_HEADERS = [
  'date',
  'merchant',
  'category',
  'account',
  'original statement',
  'notes',
  'amount',
  'transaction type',
  'tags',
]

export function isMonarchFormat(headers: string[]): boolean {
  const normalized = headers.map((h) => h.toLowerCase().trim())
  return MONARCH_HEADERS.every((mh) => normalized.includes(mh))
}

// Common column name patterns from major banks
const COLUMN_PATTERNS: Record<Exclude<AppField, 'ignore'>, string[]> = {
  date: [
    'date',
    'transaction date',
    'trans date',
    'posting date',
    'posted date',
    'transaction_date',
    'post date',
    'effective date',
    'settlement date',
    'value date',
  ],
  description: [
    'description',
    'merchant',
    'name',
    'memo',
    'transaction description',
    'payee',
    'details',
    'narrative',
    'transaction',
    'merchant name',
    'original description',
    'trans description',
  ],
  amount: [
    'amount',
    'transaction amount',
    'debit/credit',
    'value',
    'sum',
    'total',
    'net amount',
    'trans amount',
  ],
  category: ['category', 'classification', 'group', 'tag', 'label'],
  type: ['credit/debit', 'cr/dr', 'transaction type', 'type', 'debit or credit', 'flow'],
}

export const DEBIT_PATTERNS = ['debit', 'debit amount', 'withdrawal', 'charge', 'money out']
export const CREDIT_PATTERNS = ['credit', 'credit amount', 'deposit', 'payment', 'money in']

export interface ColumnMapping {
  csvColumn: string
  appField: AppField
  confidence: number // 0-1
  sampleValues: string[]
}

export function autoDetectColumns(
  headers: string[],
  sampleRows: string[][]
): ColumnMapping[] {
  return headers.map((header, index) => {
    const normalized = header.toLowerCase().trim()
    const sampleValues = sampleRows.map((row) => row[index] || '').slice(0, 5)

    // Check for debit/credit split columns
    if (DEBIT_PATTERNS.some((p) => normalized.includes(p))) {
      return { csvColumn: header, appField: 'amount' as AppField, confidence: 0.9, sampleValues }
    }
    if (CREDIT_PATTERNS.some((p) => normalized.includes(p))) {
      return { csvColumn: header, appField: 'amount' as AppField, confidence: 0.9, sampleValues }
    }

    // Match against known patterns
    let bestMatch: AppField = 'ignore'
    let bestConfidence = 0

    for (const [field, patterns] of Object.entries(COLUMN_PATTERNS)) {
      for (const pattern of patterns) {
        if (normalized === pattern) {
          bestMatch = field as AppField
          bestConfidence = 1.0
          break
        }
        if (normalized.includes(pattern) || pattern.includes(normalized)) {
          const conf = 0.8
          if (conf > bestConfidence) {
            bestMatch = field as AppField
            bestConfidence = conf
          }
        }
      }
      if (bestConfidence === 1.0) break
    }

    // Heuristic fallback: check sample values
    if (bestConfidence < 0.7) {
      if (sampleValues.some((v) => /^\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}$/.test(v))) {
        bestMatch = 'date'
        bestConfidence = 0.75
      }
      if (
        sampleValues.some((v) => /^[-$]?\d+\.?\d{0,2}$/.test(v.replace(/,/g, '')))
      ) {
        bestMatch = 'amount'
        bestConfidence = 0.7
      }
    }

    return {
      csvColumn: header,
      appField: bestMatch,
      confidence: bestConfidence,
      sampleValues,
    }
  })
}
