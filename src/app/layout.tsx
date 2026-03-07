import type { Metadata } from 'next'
import { DM_Sans, JetBrains_Mono, Fraunces } from 'next/font/google'
import { Suspense } from 'react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/next'
import { ToastProvider } from '@/components/ui/ToastProvider'
import { PostHogProvider } from '@/providers/PostHogProvider'
import { PageViewTracker } from '@/components/analytics/PageViewTracker'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains',
})

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-fraunces',
})

export const metadata: Metadata = {
  title: {
    default: 'oversikt — See your whole financial picture',
    template: '%s | oversikt',
  },
  description: 'See your whole financial picture. Simple, honest budgeting with true remaining clarity.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${jetbrainsMono.variable} ${fraunces.variable}`}>
      <body>
        <PostHogProvider>
          <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-fjord focus:px-4 focus:py-2 focus:text-snow">
            Skip to content
          </a>
          <Suspense fallback={null}>
            <PageViewTracker />
          </Suspense>
          {children}
        </PostHogProvider>
        <Analytics />
        <SpeedInsights />
        <ToastProvider />
      </body>
    </html>
  )
}
