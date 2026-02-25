import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { parseCSV } from '@/lib/csv-parser'
import { autoDetectColumns, isMonarchFormat } from '@/lib/column-mapping'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    if (!file.name.endsWith('.csv') && !file.type.includes('csv')) {
      return NextResponse.json({ error: 'File must be a CSV' }, { status: 400 })
    }

    // R11.12: CSV file size limit (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
    }

    const text = await file.text()
    const { headers, rows } = parseCSV(text)

    const monarch = isMonarchFormat(headers)

    if (monarch) {
      // Monarch format detected — skip column mapping, go straight to preview
      return NextResponse.json({
        headers,
        mappings: null,
        sampleRows: rows.slice(0, 10),
        totalRows: rows.length,
        csvText: text,
        isMonarch: true,
      })
    }

    const mappings = autoDetectColumns(headers, rows.slice(0, 10))

    return NextResponse.json({
      headers,
      mappings,
      sampleRows: rows.slice(0, 10),
      totalRows: rows.length,
      csvText: text,
      isMonarch: false,
    })
  } catch (error) {
    console.error('CSV preview failed:', error)
    return NextResponse.json({ error: 'Failed to parse CSV file' }, { status: 500 })
  }
}
