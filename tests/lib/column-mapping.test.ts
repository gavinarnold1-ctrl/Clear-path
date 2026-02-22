import { autoDetectColumns } from '@/lib/column-mapping'

describe('autoDetectColumns', () => {
  it('detects standard column names with high confidence', () => {
    const headers = ['Date', 'Description', 'Amount', 'Category']
    const sampleRows = [['01/15/2026', 'Coffee Shop', '-5.50', 'Dining']]

    const mappings = autoDetectColumns(headers, sampleRows)

    expect(mappings[0].appField).toBe('date')
    expect(mappings[0].confidence).toBe(1.0)
    expect(mappings[1].appField).toBe('description')
    expect(mappings[1].confidence).toBe(1.0)
    expect(mappings[2].appField).toBe('amount')
    expect(mappings[2].confidence).toBe(1.0)
    expect(mappings[3].appField).toBe('category')
    expect(mappings[3].confidence).toBe(1.0)
  })

  it('detects "Transaction Date" as date field', () => {
    const headers = ['Transaction Date', 'Payee', 'Net Amount']
    const sampleRows = [['01/15/2026', 'Store', '42.00']]

    const mappings = autoDetectColumns(headers, sampleRows)

    expect(mappings[0].appField).toBe('date')
    expect(mappings[1].appField).toBe('description')
    expect(mappings[2].appField).toBe('amount')
  })

  it('detects debit/credit split columns', () => {
    const headers = ['Date', 'Description', 'Debit Amount', 'Credit Amount']
    const sampleRows = [['01/15/2026', 'Coffee', '5.50', '']]

    const mappings = autoDetectColumns(headers, sampleRows)

    expect(mappings[2].appField).toBe('amount')
    expect(mappings[2].confidence).toBe(0.9)
    expect(mappings[3].appField).toBe('amount')
    expect(mappings[3].confidence).toBe(0.9)
  })

  it('falls back to heuristics for unknown column names', () => {
    const headers = ['Col1', 'Col2', 'Col3']
    const sampleRows = [['01/15/2026', 'Some text', '42.50']]

    const mappings = autoDetectColumns(headers, sampleRows)

    // Col1 has date-like values
    expect(mappings[0].appField).toBe('date')
    expect(mappings[0].confidence).toBe(0.75)
  })

  it('marks completely unknown columns as ignore', () => {
    const headers = ['Unknown Field']
    const sampleRows = [['random text here']]

    const mappings = autoDetectColumns(headers, sampleRows)

    expect(mappings[0].appField).toBe('ignore')
  })

  it('includes sample values in each mapping', () => {
    const headers = ['Date']
    const sampleRows = [
      ['01/15/2026'],
      ['01/16/2026'],
      ['01/17/2026'],
    ]

    const mappings = autoDetectColumns(headers, sampleRows)

    expect(mappings[0].sampleValues).toEqual(['01/15/2026', '01/16/2026', '01/17/2026'])
  })

  it('detects "Posting Date" as date', () => {
    const headers = ['Posting Date', 'Merchant Name', 'Transaction Amount']
    const sampleRows = [['2026-01-15', 'Store', '100.00']]

    const mappings = autoDetectColumns(headers, sampleRows)

    expect(mappings[0].appField).toBe('date')
    expect(mappings[1].appField).toBe('description')
    expect(mappings[2].appField).toBe('amount')
  })

  it('detects "Money Out" as amount (debit)', () => {
    const headers = ['Date', 'Details', 'Money Out', 'Money In']
    const sampleRows = [['01/15/2026', 'Payment', '50.00', '']]

    const mappings = autoDetectColumns(headers, sampleRows)

    expect(mappings[2].appField).toBe('amount')
    expect(mappings[3].appField).toBe('amount')
  })

  it('detects "Account" column as account field', () => {
    const headers = ['Date', 'Description', 'Amount', 'Account']
    const sampleRows = [['01/15/2026', 'Coffee Shop', '-5.50', 'Checking']]

    const mappings = autoDetectColumns(headers, sampleRows)

    expect(mappings[3].appField).toBe('account')
    expect(mappings[3].confidence).toBe(1.0)
  })

  it('detects "Account Name" as account field', () => {
    const headers = ['Date', 'Account Name', 'Amount']
    const sampleRows = [['01/15/2026', 'Savings', '100.00']]

    const mappings = autoDetectColumns(headers, sampleRows)

    expect(mappings[1].appField).toBe('account')
  })
})
