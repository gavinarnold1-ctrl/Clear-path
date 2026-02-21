import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Strict output for easier deployment
  output: 'standalone',
  experimental: {
    // Enable server actions
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
}

export default nextConfig
