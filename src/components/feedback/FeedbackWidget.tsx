'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { trackFeedbackSubmitted } from '@/lib/analytics'

function IconFeedback({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <line x1="12" y1="7" x2="12" y2="13" />
      <line x1="9" y1="10" x2="15" y2="10" />
    </svg>
  )
}

function IconBug({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2l1.88 1.88M14.12 3.88L16 2M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" />
      <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" />
      <path d="M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M20.97 5c0 2.1-1.6 3.8-3.5 4M22 13h-4M17.2 17c2.1.1 3.8 1.9 3.8 4" />
    </svg>
  )
}

function IconLightbulb({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6M10 22h4" />
    </svg>
  )
}

function IconMessage({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}

function IconX({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function IconSend({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

const FEEDBACK_TYPES = [
  { value: 'bug', label: 'Bug Report', icon: IconBug, color: 'text-ember' },
  { value: 'feature', label: 'Feature Request', icon: IconLightbulb, color: 'text-pine' },
  { value: 'general', label: 'General Feedback', icon: IconMessage, color: 'text-fjord' },
] as const

export function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [type, setType] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const pathname = usePathname()

  async function handleSubmit() {
    if (!type || !message.trim()) return
    setSubmitting(true)

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          message: message.trim(),
          page: pathname,
          metadata: {
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
          },
        }),
      })

      if (res.ok) {
        setSubmitted(true)
        trackFeedbackSubmitted(type, pathname)
        setTimeout(() => {
          setIsOpen(false)
          setSubmitted(false)
          setType(null)
          setMessage('')
        }, 2000)
      }
    } catch {
      // Silently fail — feedback is not critical path
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-6 z-50 md:bottom-6 bg-fjord text-snow p-3 rounded-full shadow-lg hover:bg-fjord/90 transition-all hover:scale-105"
        aria-label="Send feedback"
      >
        <IconFeedback className="w-5 h-5" />
      </button>
    )
  }

  return (
    <div className="fixed bottom-20 right-6 z-50 md:bottom-6 w-80 max-w-[calc(100vw-3rem)] bg-snow border border-mist rounded-card shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-frost">
        <h3 className="text-sm font-medium text-midnight">Send Feedback</h3>
        <button onClick={() => setIsOpen(false)} className="text-stone hover:text-midnight">
          <IconX className="w-4 h-4" />
        </button>
      </div>

      {submitted ? (
        <div className="p-6 text-center">
          <p className="text-pine font-medium">Thank you!</p>
          <p className="text-sm text-stone mt-1">Your feedback helps improve oversikt.</p>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {/* Type selector */}
          <div className="flex gap-2">
            {FEEDBACK_TYPES.map(({ value, label, icon: Icon, color }) => (
              <button
                key={value}
                onClick={() => setType(value)}
                className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-button border text-xs transition-all ${
                  type === value
                    ? 'border-fjord bg-fjord/5 font-medium'
                    : 'border-mist hover:border-stone'
                }`}
              >
                <Icon className={`w-4 h-4 ${type === value ? color : 'text-stone'}`} />
                {label}
              </button>
            ))}
          </div>

          {/* Message */}
          {type && (
            <>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  type === 'bug' ? 'What went wrong?'
                  : type === 'feature' ? 'What would you like to see?'
                  : 'Tell us what you think...'
                }
                className="w-full h-24 px-3 py-2 text-sm border border-mist rounded-button resize-none focus:outline-none focus:ring-2 focus:ring-fjord/20 focus:border-fjord"
                maxLength={2000}
                autoFocus
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-stone">{message.length}/2000</span>
                <button
                  onClick={handleSubmit}
                  disabled={!message.trim() || submitting}
                  className="flex items-center gap-1 px-3 py-1.5 bg-fjord text-snow text-sm rounded-button hover:bg-fjord/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <IconSend className="w-3 h-3" />
                  {submitting ? 'Sending...' : 'Send'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
