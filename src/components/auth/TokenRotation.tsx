'use client'

import { useEffect } from 'react'

/**
 * Client component that triggers full token rotation after a middleware soft refresh.
 * The middleware sets a short-lived cookie `oversikt-needs-rotation=1` when it
 * refreshes the access token without rotating the refresh token. This component
 * detects that cookie and calls POST /api/auth/refresh to do the full DB-backed rotation.
 */
export function TokenRotation() {
  useEffect(() => {
    const cookie = document.cookie
      .split('; ')
      .find((c) => c.startsWith('oversikt-needs-rotation='))

    if (!cookie) return

    // Delete the cookie immediately to prevent duplicate calls
    document.cookie = 'oversikt-needs-rotation=; path=/; max-age=0'

    fetch('/api/auth/refresh', { method: 'POST' }).catch(() => {
      // Rotation failed — user will be rotated on next soft refresh cycle
    })
  }, [])

  return null
}
