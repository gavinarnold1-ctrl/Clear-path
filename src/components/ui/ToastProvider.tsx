'use client'

import { Toaster } from 'react-hot-toast'

export function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        duration: 3000,
        style: {
          background: '#1B3A4B',
          color: '#F7F9F8',
          borderRadius: '8px',
          fontSize: '14px',
          fontFamily: 'var(--font-dm-sans)',
          padding: '12px 16px',
        },
        success: {
          iconTheme: {
            primary: '#2D5F3E',
            secondary: '#F7F9F8',
          },
        },
        error: {
          iconTheme: {
            primary: '#C4704B',
            secondary: '#F7F9F8',
          },
          duration: 5000,
        },
      }}
    />
  )
}
