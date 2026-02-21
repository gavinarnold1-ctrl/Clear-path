import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '@/lib/password'

describe('hashPassword', () => {
  it('returns a bcrypt hash string', async () => {
    const hash = await hashPassword('mysecretpassword')
    // bcrypt hashes start with $2b$ (or $2a$)
    expect(hash).toMatch(/^\$2[ab]\$/)
  })

  it('produces different hashes for the same plaintext (random salt)', async () => {
    const h1 = await hashPassword('samepassword')
    const h2 = await hashPassword('samepassword')
    expect(h1).not.toBe(h2)
  })

  it('handles long passwords', async () => {
    const long = 'a'.repeat(72) // bcrypt max useful length
    const hash = await hashPassword(long)
    expect(hash).toMatch(/^\$2[ab]\$/)
  })
})

describe('verifyPassword', () => {
  it('returns true for the correct plaintext', async () => {
    const hash = await hashPassword('correcthorse')
    expect(await verifyPassword('correcthorse', hash)).toBe(true)
  })

  it('returns false for an incorrect plaintext', async () => {
    const hash = await hashPassword('correcthorse')
    expect(await verifyPassword('wrongpassword', hash)).toBe(false)
  })

  it('returns false for an empty string against a real hash', async () => {
    const hash = await hashPassword('notempty')
    expect(await verifyPassword('', hash)).toBe(false)
  })

  it('returns false for a completely invalid hash', async () => {
    expect(await verifyPassword('password', 'not-a-valid-hash')).toBe(false)
  })
})
