'use client'

import { useCallback, useState } from 'react'

interface CsvUploaderProps {
  onUpload: (file: File) => void
  loading: boolean
}

export default function CsvUploader({ onUpload, loading }: CsvUploaderProps) {
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith('.csv') && !file.type.includes('csv')) {
        return
      }
      setFileName(file.name)
      onUpload(file)
    },
    [onUpload]
  )

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`card flex flex-col items-center justify-center border-2 border-dashed py-12 transition-colors ${
        dragOver ? 'border-brand-400 bg-brand-50' : 'border-gray-300'
      }`}
    >
      {loading ? (
        <p className="text-sm text-gray-500">Parsing file...</p>
      ) : fileName ? (
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700">{fileName}</p>
          <p className="mt-1 text-xs text-gray-400">File selected</p>
        </div>
      ) : (
        <>
          <p className="mb-2 text-sm font-medium text-gray-700">
            Drag and drop a CSV file here
          </p>
          <p className="mb-4 text-xs text-gray-400">or click to browse</p>
          <label className="btn-secondary cursor-pointer text-sm">
            Choose file
            <input
              type="file"
              accept=".csv"
              onChange={handleChange}
              className="hidden"
            />
          </label>
        </>
      )}
    </div>
  )
}
