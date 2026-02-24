export interface ParsedTransaction {
  date: string
  merchant: string
  amount: number // negative = expense, positive = income (kept as-is from CSV)
  category?: string
  account?: string
  person?: string
  property?: string
  raw: Record<string, string>
}

export interface ParseResult {
  transactions: ParsedTransaction[]
  errors: { row: number; message: string }[]
  duplicates: number
  totalRows: number
}

function sanitizeCell(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length > 0 && /^[=+\-@\t\r]/.test(trimmed)) {
    return "'" + trimmed
  }
  return trimmed
}

export function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length === 0) throw new Error('Empty CSV file')

  const parseLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result
  }

  const headers = parseLine(lines[0])
  const rows = lines.slice(1).map(parseLine)

  return { headers, rows }
}

const DEBIT_WORDS = ['debit', 'withdrawal', 'charge', 'money out', 'dr']

export function transformRows(
  rows: string[][],
  headers: string[],
  mapping: Record<string, string> // csvColumn -> appField
): ParseResult {
  const transactions: ParsedTransaction[] = []
  const errors: { row: number; message: string }[] = []

  const dateCol = headers.findIndex((h) => mapping[h] === 'date')
  const descCol = headers.findIndex((h) => mapping[h] === 'merchant' || mapping[h] === 'description')
  const amountCols = headers
    .map((h, i) => ({ header: h, index: i }))
    .filter(({ header }) => mapping[header] === 'amount')
  const categoryCol = headers.findIndex((h) => mapping[h] === 'category')
  const accountCol = headers.findIndex((h) => mapping[h] === 'account')
  const personCol = headers.findIndex((h) => mapping[h] === 'person')
  const propertyCol = headers.findIndex((h) => mapping[h] === 'property')

  if (dateCol === -1) {
    return {
      transactions: [],
      errors: [{ row: 0, message: 'No date column mapped' }],
      duplicates: 0,
      totalRows: rows.length,
    }
  }
  if (amountCols.length === 0) {
    return {
      transactions: [],
      errors: [{ row: 0, message: 'No amount column mapped' }],
      duplicates: 0,
      totalRows: rows.length,
    }
  }

  rows.forEach((row, rowIndex) => {
    try {
      if (row.every((cell) => !cell.trim())) return

      const rawDate = row[dateCol]?.trim()
      if (!rawDate) {
        errors.push({ row: rowIndex + 2, message: 'Missing date' })
        return
      }
      const date = parseDate(rawDate)
      if (!date) {
        errors.push({ row: rowIndex + 2, message: `Invalid date: ${rawDate}` })
        return
      }

      const rawMerchant = descCol >= 0 ? row[descCol]?.trim() || 'Unknown' : 'Unknown'
      const merchant = sanitizeCell(rawMerchant)

      let amount = 0
      if (amountCols.length === 1) {
        const rawAmount = row[amountCols[0].index]?.trim()
        amount = parseAmount(rawAmount)
      } else {
        for (const col of amountCols) {
          const val = row[col.index]?.trim()
          if (val) {
            const parsed = parseAmount(val)
            const headerLower = col.header.toLowerCase()
            if (DEBIT_WORDS.some((w) => headerLower.includes(w))) {
              amount -= Math.abs(parsed)
            } else {
              amount += Math.abs(parsed)
            }
          }
        }
      }

      if (amount === 0 && !row.some((cell) => cell.includes('0.00'))) {
        errors.push({ row: rowIndex + 2, message: 'Could not parse amount' })
        return
      }

      const rawCategory = categoryCol >= 0 ? row[categoryCol]?.trim() || undefined : undefined
      const category = rawCategory ? sanitizeCell(rawCategory) : undefined
      const rawAccount = accountCol >= 0 ? row[accountCol]?.trim() || undefined : undefined
      const account = rawAccount ? sanitizeCell(rawAccount) : undefined
      const rawPerson = personCol >= 0 ? row[personCol]?.trim() || undefined : undefined
      const person = rawPerson ? sanitizeCell(rawPerson) : undefined
      const rawProperty = propertyCol >= 0 ? row[propertyCol]?.trim() || undefined : undefined
      const property = rawProperty ? sanitizeCell(rawProperty) : undefined

      const raw: Record<string, string> = {}
      headers.forEach((h, i) => {
        raw[h] = row[i] || ''
      })

      // Keep amount sign as-is: negative = expense, positive = income
      transactions.push({
        date: date.toISOString().split('T')[0],
        merchant,
        amount,
        category,
        ...(account && { account }),
        ...(person && { person }),
        ...(property && { property }),
        raw,
      })
    } catch (err) {
      errors.push({ row: rowIndex + 2, message: String(err) })
    }
  })

  return {
    transactions,
    errors,
    duplicates: 0,
    totalRows: rows.length,
  }
}

export function parseDate(raw: string): Date | null {
  const formats: { regex: RegExp; parse: (m: RegExpMatchArray) => Date }[] = [
    {
      regex: /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
      parse: (m) => new Date(+m[1], +m[2] - 1, +m[3]),
    },
    {
      regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
      parse: (m) => new Date(+m[3], +m[1] - 1, +m[2]),
    },
    {
      regex: /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
      parse: (m) => new Date(+m[3], +m[1] - 1, +m[2]),
    },
    {
      regex: /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/,
      parse: (m) => {
        const yr = +m[3]
        return new Date(yr > 50 ? 1900 + yr : 2000 + yr, +m[1] - 1, +m[2])
      },
    },
  ]

  for (const { regex, parse } of formats) {
    const match = raw.match(regex)
    if (match) {
      const date = parse(match)
      if (!isNaN(date.getTime())) return date
    }
  }

  const fallback = new Date(raw)
  return isNaN(fallback.getTime()) ? null : fallback
}

export function parseAmount(raw: string): number {
  if (!raw) return 0
  let cleaned = raw.replace(/[$€£¥\s]/g, '').replace(/,/g, '')

  // Handle parentheses as negative: (123.45) -> -123.45
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = '-' + cleaned.slice(1, -1)
  }

  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}
