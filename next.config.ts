import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Include the CSV data file in serverless function bundles so /api/reimport can read it
  outputFileTracingIncludes: {
    '/api/reimport': ['./docs/Transactions_2026-02-21T21-30-39.csv'],
  },

  // R11.12: Security headers on all responses
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '0' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
