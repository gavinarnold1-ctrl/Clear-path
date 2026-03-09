import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard/',
          '/api/',
          '/settings/',
          '/onboarding/',
          '/accounts/',
          '/budgets/',
          '/transactions/',
          '/properties/',
          '/debts/',
          '/insights/',
          '/forecast/',
          '/monthly-review/',
        ],
      },
    ],
    sitemap: 'https://oversikt.io/sitemap.xml',
  }
}
