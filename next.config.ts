import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
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
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.plaid.com https://va.vercel-scripts.com https://us-assets.i.posthog.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://*.plaid.com https://cdn.plaid.com https://api.anthropic.com https://va.vercel-scripts.com https://us.i.posthog.com",
              "frame-src 'self' https://*.plaid.com",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig
