import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    feedback: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

import { POST, GET } from '@/app/api/feedback/route'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'

const mockGetSession = getSession as ReturnType<typeof vi.fn>
const mockCreate = db.feedback.create as ReturnType<typeof vi.fn>
const mockFindMany = db.feedback.findMany as ReturnType<typeof vi.fn>

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/feedback', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates feedback record for authenticated user', async () => {
    mockGetSession.mockResolvedValue({ userId: 'u1', email: 'a@b.com' })
    mockCreate.mockResolvedValue({ id: 'fb1' })

    const res = await POST(makeRequest({ type: 'bug', message: 'Broken page', page: '/dashboard' }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.id).toBe('fb1')
    expect(data.status).toBe('submitted')
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1',
        type: 'bug',
        message: 'Broken page',
        page: '/dashboard',
      }),
    })
  })

  it('rejects unauthenticated requests', async () => {
    mockGetSession.mockResolvedValue(null)
    const res = await POST(makeRequest({ type: 'bug', message: 'Test' }))
    expect(res.status).toBe(401)
  })

  it('validates type is bug/feature/general', async () => {
    mockGetSession.mockResolvedValue({ userId: 'u1', email: 'a@b.com' })
    const res = await POST(makeRequest({ type: 'invalid', message: 'Test' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Invalid type')
  })

  it('requires message', async () => {
    mockGetSession.mockResolvedValue({ userId: 'u1', email: 'a@b.com' })
    const res = await POST(makeRequest({ type: 'bug', message: '' }))
    expect(res.status).toBe(400)
  })

  it('rejects messages over 2000 chars', async () => {
    mockGetSession.mockResolvedValue({ userId: 'u1', email: 'a@b.com' })
    const res = await POST(makeRequest({ type: 'bug', message: 'x'.repeat(2001) }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Message too long')
  })
})

describe('GET /api/feedback', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns feedback for authenticated user', async () => {
    mockGetSession.mockResolvedValue({ userId: 'u1', email: 'a@b.com' })
    mockFindMany.mockResolvedValue([{ id: 'fb1', type: 'bug', message: 'Test' }])

    const req = new Request('http://localhost/api/feedback')
    const res = await GET()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.feedback).toHaveLength(1)
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  })

  it('rejects unauthenticated requests', async () => {
    mockGetSession.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })
})
