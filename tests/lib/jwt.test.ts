// @vitest-environment node
// jose uses TextEncoder internally; jsdom's realm differs from Node's, causing
// `instanceof Uint8Array` checks to fail. The Node environment avoids this.
import { describe, it, expect, beforeAll } from 'vitest'
import { signToken, verifyToken, SESSION_COOKIE } from '@/lib/jwt'

beforeAll(() => {
  if (!process.env.SESSION_SECRET) {
    process.env.SESSION_SECRET = 'test-secret-for-jwt-tests-at-least-32-chars'
  }
})

describe('SESSION_COOKIE', () => {
  it('is a non-empty string', () => {
    expect(typeof SESSION_COOKIE).toBe('string')
    expect(SESSION_COOKIE.length).toBeGreaterThan(0)
  })
})

describe('signToken / verifyToken', () => {
  const payload = { userId: 'user-123', email: 'test@example.com', name: 'Test User' }

  it('returns a JWT string', async () => {
    const token = await signToken(payload)
    expect(typeof token).toBe('string')
    // JWTs have three base64url-encoded parts separated by dots
    expect(token.split('.').length).toBe(3)
  })

  it('round-trips the full payload', async () => {
    const token = await signToken(payload)
    const decoded = await verifyToken(token)
    expect(decoded).toMatchObject(payload)
  })

  it('preserves null name', async () => {
    const token = await signToken({ ...payload, name: null })
    const decoded = await verifyToken(token)
    expect(decoded?.name).toBeNull()
  })

  it('returns null for a completely invalid string', async () => {
    expect(await verifyToken('not-a-jwt')).toBeNull()
  })

  it('returns null for a tampered signature', async () => {
    const token = await signToken(payload)
    const parts = token.split('.')
    parts[2] = parts[2].slice(0, -4) + 'XXXX'
    expect(await verifyToken(parts.join('.'))).toBeNull()
  })

  it('returns null for a token with a tampered payload', async () => {
    const token = await signToken(payload)
    const parts = token.split('.')
    const altPayload = Buffer.from(JSON.stringify({ userId: 'hacker', email: 'x@x.com', name: null })).toString('base64url')
    parts[1] = altPayload
    expect(await verifyToken(parts.join('.'))).toBeNull()
  })
})
