import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks must be declared before any imports that reference them ---

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(),
  setSession: vi.fn(),
  clearSession: vi.fn(),
}))

vi.mock('@/lib/password', () => ({
  hashPassword: vi.fn().mockResolvedValue('$2b$12$hashed'),
  verifyPassword: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
}))

// --- Imports after mocks ---
import { login, register, logout } from '@/app/actions/auth'
import { db } from '@/lib/db'
import { setSession, clearSession } from '@/lib/session'
import { verifyPassword } from '@/lib/password'

// Typed mock helpers
const mockUser = db.user as { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> }
const mockSetSession = setSession as ReturnType<typeof vi.fn>
const mockClearSession = clearSession as ReturnType<typeof vi.fn>
const mockVerifyPassword = verifyPassword as ReturnType<typeof vi.fn>

function fd(data: Record<string, string>): FormData {
  const f = new FormData()
  Object.entries(data).forEach(([k, v]) => f.append(k, v))
  return f
}

// ─── login ─────────────────────────────────────────────────────────────────

describe('login', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns error when email is empty', async () => {
    const result = await login({ error: null }, fd({ email: '', password: 'password123' }))
    expect(result.error).toBeTruthy()
  })

  it('returns error when password is empty', async () => {
    const result = await login({ error: null }, fd({ email: 'a@b.com', password: '' }))
    expect(result.error).toBeTruthy()
  })

  it('returns error when user is not found', async () => {
    mockUser.findUnique.mockResolvedValue(null)
    const result = await login({ error: null }, fd({ email: 'a@b.com', password: 'pass123' }))
    expect(result.error).toBe('Invalid email or password.')
  })

  it('returns error when password does not match', async () => {
    mockUser.findUnique.mockResolvedValue({ id: '1', email: 'a@b.com', name: null, password: 'hash' })
    mockVerifyPassword.mockResolvedValue(false)
    const result = await login({ error: null }, fd({ email: 'a@b.com', password: 'wrong' }))
    expect(result.error).toBe('Invalid email or password.')
  })

  it('normalises email to lowercase before lookup', async () => {
    mockUser.findUnique.mockResolvedValue(null)
    await login({ error: null }, fd({ email: 'UPPER@Example.COM', password: 'pass' }))
    expect(mockUser.findUnique).toHaveBeenCalledWith({ where: { email: 'upper@example.com' } })
  })

  it('sets session and redirects to /dashboard on success', async () => {
    mockUser.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', name: 'Alice', password: 'hash', refreshTokenVersion: 0 })
    mockVerifyPassword.mockResolvedValue(true)
    mockSetSession.mockResolvedValue(undefined)

    await expect(login({ error: null }, fd({ email: 'a@b.com', password: 'correct' }))).rejects.toThrow(
      'NEXT_REDIRECT:/dashboard'
    )
    expect(mockSetSession).toHaveBeenCalledWith({ userId: 'u1', email: 'a@b.com', name: 'Alice' }, 0)
  })
})

// ─── register ──────────────────────────────────────────────────────────────

describe('register', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns error when email is missing', async () => {
    const result = await register({ error: null }, fd({ email: '', name: 'Alice', password: 'password123' }))
    expect(result.error).toBeTruthy()
  })

  it('returns error when password is too short', async () => {
    const result = await register({ error: null }, fd({ email: 'a@b.com', name: 'Alice', password: 'short' }))
    expect(result.error).toContain('8 characters')
  })

  it('returns error when TOS is not accepted', async () => {
    const result = await register({ error: null }, fd({ email: 'a@b.com', name: 'Alice', password: 'password123' }))
    expect(result.error).toContain('Terms of Service')
  })

  it('returns error when email already exists', async () => {
    mockUser.findUnique.mockResolvedValue({ id: '1' })
    const result = await register({ error: null }, fd({ email: 'a@b.com', name: 'Alice', password: 'password123', tos: 'on' }))
    expect(result.error).toContain('Unable to create account')
  })

  it('creates user and redirects to /dashboard on success', async () => {
    mockUser.findUnique.mockResolvedValue(null)
    mockUser.create.mockResolvedValue({ id: 'new-id', email: 'new@b.com', name: 'Bob', refreshTokenVersion: 0 })
    mockSetSession.mockResolvedValue(undefined)

    await expect(
      register({ error: null }, fd({ email: 'new@b.com', name: 'Bob', password: 'password123', tos: 'on' }))
    ).rejects.toThrow('NEXT_REDIRECT:/onboarding')
    expect(mockUser.create).toHaveBeenCalled()
    expect(mockSetSession).toHaveBeenCalledWith({ userId: 'new-id', email: 'new@b.com', name: 'Bob' }, 0)
  })

  it('treats blank name as null', async () => {
    mockUser.findUnique.mockResolvedValue(null)
    mockUser.create.mockResolvedValue({ id: 'x', email: 'x@b.com', name: null, refreshTokenVersion: 0 })
    mockSetSession.mockResolvedValue(undefined)

    await expect(
      register({ error: null }, fd({ email: 'x@b.com', name: '', password: 'password123', tos: 'on' }))
    ).rejects.toThrow('NEXT_REDIRECT:/onboarding')

    const createCall = mockUser.create.mock.calls[0][0]
    expect(createCall.data.name).toBeNull()
  })
})

// ─── logout ────────────────────────────────────────────────────────────────

describe('logout', () => {
  it('clears the session and redirects to /login', async () => {
    mockClearSession.mockResolvedValue(undefined)
    await expect(logout()).rejects.toThrow('NEXT_REDIRECT:/login')
    expect(mockClearSession).toHaveBeenCalledOnce()
  })
})
