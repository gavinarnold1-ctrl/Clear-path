'use client'

import { useState, useEffect, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'oversikt-install-dismissed'
const VIEW_KEY = 'oversikt-page-views'
const VIEW_THRESHOLD = 3

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window)
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches
}

export default function InstallPrompt() {
  const [visible, setVisible] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [iosDevice, setIosDevice] = useState(false)

  useEffect(() => {
    // Don't show if already installed or previously dismissed
    if (isStandalone()) return
    if (localStorage.getItem(DISMISS_KEY) === 'true') return

    // Don't show on desktop
    if (window.innerWidth > 768) return

    // Increment page view counter
    const views = parseInt(localStorage.getItem(VIEW_KEY) || '0', 10) + 1
    localStorage.setItem(VIEW_KEY, String(views))

    if (views < VIEW_THRESHOLD) return

    // Detect iOS
    if (isIOS()) {
      setIosDevice(true)
      setVisible(true)
      return
    }

    // Android: wait for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const dismiss = useCallback(() => {
    setVisible(false)
    localStorage.setItem(DISMISS_KEY, 'true')
  }, [])

  const install = useCallback(async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setVisible(false)
    }
    setDeferredPrompt(null)
  }, [deferredPrompt])

  if (!visible) return null

  return (
    <div className="fixed inset-x-4 bottom-20 z-50 rounded-card border border-mist bg-snow p-4 shadow-lg md:hidden">
      <div className="flex items-start gap-3">
        {/* App icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-fjord">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F7F9F8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12l9-8 9 8" />
            <path d="M5 10v9a1 1 0 001 1h3v-5h6v5h3a1 1 0 001-1v-9" />
          </svg>
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-fjord">Add Oversikt to your home screen</p>
          {iosDevice && (
            <p className="mt-0.5 text-xs text-stone">
              Tap the share button <span className="inline-block rotate-[-45deg]">↗</span> then &ldquo;Add to Home Screen&rdquo;
            </p>
          )}
        </div>

        {/* Close button */}
        <button
          type="button"
          onClick={dismiss}
          className="flex h-11 w-11 shrink-0 items-center justify-center text-stone hover:text-fjord"
          aria-label="Dismiss install prompt"
        >
          ✕
        </button>
      </div>

      {/* Android install button */}
      {deferredPrompt && !iosDevice && (
        <button
          type="button"
          onClick={install}
          className="mt-3 w-full rounded-button bg-pine py-2 text-sm font-medium text-snow"
        >
          Install
        </button>
      )}
    </div>
  )
}
