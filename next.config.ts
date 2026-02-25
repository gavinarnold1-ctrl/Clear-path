import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Include the CSV data file in serverless function bundles so /api/reimport can read it
  outputFileTracingIncludes: {
    '/api/reimport': ['./docs/Transactions_2026-02-21T21-30-39.csv'],
  },
}

export default nextConfig
