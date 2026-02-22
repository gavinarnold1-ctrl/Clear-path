import { parseCSV, parseDate, parseAmount, transformRows } from '@/lib/csv-parser'

describe('parseCSV', () => {
  it('parses basic CSV with headers and rows', () => {
    const csv = 'Date,Description,Amount\n01/15/2026,Coffee Shop,5.50\n01/16/2026,Grocery Store,42.30'
    const result = parseCSV(csv)

    expect(result.headers).toEqual(['Date', 'Description', 'Amount'])
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toEqual(['01/15/2026', 'Coffee Shop', '5.50'])
  })

  it('handles quoted fields with commas inside', () => {
    const csv = 'Date,Description,Amount\n01/15/2026,"Smith, John - Payment",100.00'
    const result = parseCSV(csv)

    expect(result.rows[0][1]).toBe('Smith, John - Payment')
  })

  it('handles Windows-style line endings (CRLF)', () => {
    const csv = 'Date,Amount\r\n01/15/2026,10.00\r\n01/16/2026,20.00'
    const result = parseCSV(csv)

    expect(result.rows).toHaveLength(2)
  })

  it('skips empty lines', () => {
    const csv = 'Date,Amount\n01/15/2026,10.00\n\n01/16/2026,20.00\n'
    const result = parseCSV(csv)

    expect(result.rows).toHaveLength(2)
  })

  it('throws on empty input', () => {
    expect(() => parseCSV('')).toThrow('Empty CSV file')
  })
})

describe('parseDate', () => {
  it('parses ISO format (YYYY-MM-DD)', () => {
    const date = parseDate('2026-01-15')
    expect(date).not.toBeNull()
    expect(date!.getFullYear()).toBe(2026)
    expect(date!.getMonth()).toBe(0) // January
    expect(date!.getDate()).toBe(15)
  })

  it('parses MM/DD/YYYY format', () => {
    const date = parseDate('01/15/2026')
    expect(date).not.toBeNull()
    expect(date!.getFullYear()).toBe(2026)
    expect(date!.getMonth()).toBe(0)
    expect(date!.getDate()).toBe(15)
  })

  it('parses MM-DD-YYYY format', () => {
    const date = parseDate('01-15-2026')
    expect(date).not.toBeNull()
    expect(date!.getFullYear()).toBe(2026)
  })

  it('parses short year MM/DD/YY', () => {
    const date = parseDate('01/15/26')
    expect(date).not.toBeNull()
    expect(date!.getFullYear()).toBe(2026)
  })

  it('treats short year > 50 as 1900s', () => {
    const date = parseDate('01/15/99')
    expect(date).not.toBeNull()
    expect(date!.getFullYear()).toBe(1999)
  })

  it('returns null for invalid date string', () => {
    expect(parseDate('not-a-date')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseDate('')).toBeNull()
  })
})

describe('parseAmount', () => {
  it('parses simple number', () => {
    expect(parseAmount('42.50')).toBe(42.5)
  })

  it('parses negative number', () => {
    expect(parseAmount('-100.00')).toBe(-100)
  })

  it('strips dollar sign', () => {
    expect(parseAmount('$42.50')).toBe(42.5)
  })

  it('strips commas from thousands', () => {
    expect(parseAmount('1,234.56')).toBe(1234.56)
  })

  it('handles parentheses as negative', () => {
    expect(parseAmount('(123.45)')).toBe(-123.45)
  })

  it('strips currency symbols (€, £, ¥)', () => {
    expect(parseAmount('€100.00')).toBe(100)
    expect(parseAmount('£50.00')).toBe(50)
  })

  it('returns 0 for empty string', () => {
    expect(parseAmount('')).toBe(0)
  })

  it('returns 0 for non-numeric string', () => {
    expect(parseAmount('abc')).toBe(0)
  })
})

describe('transformRows', () => {
  const headers = ['Date', 'Description', 'Amount', 'Category']
  const mapping: Record<string, string> = {
    Date: 'date',
    Description: 'description',
    Amount: 'amount',
    Category: 'category',
  }

  it('transforms valid rows into transactions', () => {
    const rows = [
      ['01/15/2026', 'Coffee Shop', '-5.50', 'Dining'],
      ['01/16/2026', 'Salary', '3000.00', 'Income'],
    ]

    const result = transformRows(rows, headers, mapping)

    expect(result.transactions).toHaveLength(2)
    expect(result.transactions[0].description).toBe('Coffee Shop')
    expect(result.transactions[0].amount).toBe(5.5)
    expect(result.transactions[0].type).toBe('EXPENSE')
    expect(result.transactions[0].category).toBe('Dining')

    expect(result.transactions[1].description).toBe('Salary')
    expect(result.transactions[1].amount).toBe(3000)
    expect(result.transactions[1].type).toBe('INCOME')
  })

  it('reports error when date column is not mapped', () => {
    const result = transformRows([['val']], ['Col'], { Col: 'description' })
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('No date column')
  })

  it('reports error when amount column is not mapped', () => {
    const result = transformRows([['01/15/2026']], ['Col'], { Col: 'date' })
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('No amount column')
  })

  it('reports error for rows with invalid dates', () => {
    const rows = [['not-a-date', 'Test', '10.00', '']]
    const result = transformRows(rows, headers, mapping)

    expect(result.transactions).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('Invalid date')
  })

  it('skips completely empty rows', () => {
    const rows = [
      ['01/15/2026', 'Coffee', '-5.50', ''],
      ['', '', '', ''],
      ['01/16/2026', 'Lunch', '-12.00', ''],
    ]
    const result = transformRows(rows, headers, mapping)

    expect(result.transactions).toHaveLength(2)
    expect(result.errors).toHaveLength(0)
  })

  it('uses "Unknown" for missing description', () => {
    const rows = [['01/15/2026', '', '-5.50', '']]
    const result = transformRows(rows, headers, mapping)

    expect(result.transactions[0].description).toBe('Unknown')
  })

  it('preserves raw CSV data on each transaction', () => {
    const rows = [['01/15/2026', 'Test', '10.00', 'Food']]
    const result = transformRows(rows, headers, mapping)

    expect(result.transactions[0].raw).toEqual({
      Date: '01/15/2026',
      Description: 'Test',
      Amount: '10.00',
      Category: 'Food',
    })
  })

  it('handles debit/credit split columns', () => {
    const splitHeaders = ['Date', 'Description', 'Debit', 'Credit']
    const splitMapping: Record<string, string> = {
      Date: 'date',
      Description: 'description',
      Debit: 'amount',
      Credit: 'amount',
    }

    const rows = [
      ['01/15/2026', 'Coffee', '5.50', ''],
      ['01/16/2026', 'Refund', '', '20.00'],
    ]

    const result = transformRows(rows, splitHeaders, splitMapping)

    expect(result.transactions).toHaveLength(2)
    // Debit column → negative → EXPENSE
    expect(result.transactions[0].type).toBe('EXPENSE')
    expect(result.transactions[0].amount).toBe(5.5)
    // Credit column → positive → INCOME
    expect(result.transactions[1].type).toBe('INCOME')
    expect(result.transactions[1].amount).toBe(20)
  })
})
