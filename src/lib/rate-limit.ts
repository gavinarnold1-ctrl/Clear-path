/**
 * In-memory sliding-window rate limiter.
 *
 * Each bucket is identified by a key (e.g. IP address or userId).
 * Entries expire and are lazily cleaned up to avoid unbounded memory growth.
 *
 * In development (NODE_ENV === 'development'), all limits are multiplied by 10.
 */

interface RateLimitEntry {
  timestamps: number[]
}

const store = new Map<string, RateLimitEntry>()

const DEV_MULTIPLIER = process.env.NODE_ENV === 'development' ? 10 : 1

/** Clean expired entries periodically (every 5 minutes). */
let lastCleanup = Date.now()
const CLEANUP_INTERVAL = 5 * 60 * 1000

function cleanup(windowMs: number) {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  const cutoff = now - windowMs * 2 // generous cutoff
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff)
    if (entry.timestamps.length === 0) store.delete(key)
  }
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number | null
}

/**
 * Check and consume a rate limit token.
 * @param key - Unique identifier (IP, userId, etc.)
 * @param maxRequests - Maximum requests allowed in the window
 * @param windowMs - Time window in milliseconds
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  const effectiveMax = maxRequests * DEV_MULTIPLIER
  const now = Date.now()

  cleanup(windowMs)

  let entry = store.get(key)
  if (!entry) {
    entry = { timestamps: [] }
    store.set(key, entry)
  }

  // Remove timestamps outside the window
  const cutoff = now - windowMs
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff)

  if (entry.timestamps.length >= effectiveMax) {
    // Rate limited — calculate retry-after from oldest timestamp in window
    const oldestInWindow = entry.timestamps[0]
    const retryAfterMs = oldestInWindow + windowMs - now
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    }
  }

  entry.timestamps.push(now)
  return {
    allowed: true,
    remaining: effectiveMax - entry.timestamps.length,
    retryAfterSeconds: null,
  }
}

/** Rate limit configurations for different route groups. */
export const RATE_LIMITS = {
  /** /api/auth/demo, login action: 5 per 15 min per IP */
  login: { maxRequests: 5, windowMs: 15 * 60 * 1000 },
  /** /api/auth/register: 3 per hour per IP */
  register: { maxRequests: 3, windowMs: 60 * 60 * 1000 },
  /** /api/plaid/*: 10 per min per user */
  plaid: { maxRequests: 10, windowMs: 60 * 1000 },
  /** /api/transactions/import/*: 10 per hour per user */
  import: { maxRequests: 10, windowMs: 60 * 60 * 1000 },
  /** /api/transactions/export: 5 per hour per user */
  export: { maxRequests: 5, windowMs: 60 * 60 * 1000 },
  /** /api/budgets/generate: 3 AI budget generations per hour per user */
  budgetGenerate: { maxRequests: 3, windowMs: 60 * 60 * 1000 },
  /** /api/forecast: 30 per minute per user */
  forecast: { maxRequests: 30, windowMs: 60 * 1000 },
  /** All other API routes: 30 per min per user */
  general: { maxRequests: 30, windowMs: 60 * 1000 },
} as const
