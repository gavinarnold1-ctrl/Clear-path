import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget'

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/dashboard'),
}))

vi.mock('@/lib/analytics', () => ({
  trackFeedbackSubmitted: vi.fn(),
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('FeedbackWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cleanup()
  })

  it('renders floating button in closed state', () => {
    render(<FeedbackWidget />)
    expect(screen.getByLabelText('Send feedback')).toBeTruthy()
  })

  it('opens panel on button click', () => {
    render(<FeedbackWidget />)
    fireEvent.click(screen.getByLabelText('Send feedback'))
    expect(screen.getByText('Send Feedback')).toBeTruthy()
  })

  it('shows type selector with 3 options', () => {
    render(<FeedbackWidget />)
    fireEvent.click(screen.getByLabelText('Send feedback'))
    expect(screen.getByText('Bug Report')).toBeTruthy()
    expect(screen.getByText('Feature Request')).toBeTruthy()
    expect(screen.getByText('General Feedback')).toBeTruthy()
  })

  it('shows textarea after selecting type', () => {
    render(<FeedbackWidget />)
    fireEvent.click(screen.getByLabelText('Send feedback'))
    fireEvent.click(screen.getByText('Bug Report'))
    expect(screen.getByPlaceholderText('What went wrong?')).toBeTruthy()
  })

  it('shows feature request placeholder', () => {
    render(<FeedbackWidget />)
    fireEvent.click(screen.getByLabelText('Send feedback'))
    fireEvent.click(screen.getByText('Feature Request'))
    expect(screen.getByPlaceholderText('What would you like to see?')).toBeTruthy()
  })

  it('shows general feedback placeholder', () => {
    render(<FeedbackWidget />)
    fireEvent.click(screen.getByLabelText('Send feedback'))
    fireEvent.click(screen.getByText('General Feedback'))
    expect(screen.getByPlaceholderText('Tell us what you think...')).toBeTruthy()
  })

  it('submits feedback via POST /api/feedback', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: '1', status: 'submitted' }) })

    render(<FeedbackWidget />)
    fireEvent.click(screen.getByLabelText('Send feedback'))
    fireEvent.click(screen.getByText('Bug Report'))
    fireEvent.change(screen.getByPlaceholderText('What went wrong?'), {
      target: { value: 'Something broke' },
    })
    fireEvent.click(screen.getByText('Send'))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/feedback', expect.objectContaining({
        method: 'POST',
      }))
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.type).toBe('bug')
    expect(body.message).toBe('Something broke')
    expect(body.page).toBe('/dashboard')
    expect(body.metadata).toBeDefined()
  })

  it('shows thank you message after submission', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: '1', status: 'submitted' }) })

    render(<FeedbackWidget />)
    fireEvent.click(screen.getByLabelText('Send feedback'))
    fireEvent.click(screen.getByText('Bug Report'))
    fireEvent.change(screen.getByPlaceholderText('What went wrong?'), {
      target: { value: 'Something broke' },
    })
    fireEvent.click(screen.getByText('Send'))

    await waitFor(() => {
      expect(screen.getByText('Thank you!')).toBeTruthy()
    })
  })

  it('includes current page path in submission', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: '1', status: 'submitted' }) })

    render(<FeedbackWidget />)
    fireEvent.click(screen.getByLabelText('Send feedback'))
    fireEvent.click(screen.getByText('Bug Report'))
    fireEvent.change(screen.getByPlaceholderText('What went wrong?'), {
      target: { value: 'Test' },
    })
    fireEvent.click(screen.getByText('Send'))

    await waitFor(() => {
      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.page).toBe('/dashboard')
    })
  })

  it('enforces 2000 character limit', () => {
    render(<FeedbackWidget />)
    fireEvent.click(screen.getByLabelText('Send feedback'))
    fireEvent.click(screen.getByText('Bug Report'))
    const textarea = screen.getByPlaceholderText('What went wrong?') as HTMLTextAreaElement
    expect(textarea.maxLength).toBe(2000)
  })

  it('disables send button when message is empty', () => {
    render(<FeedbackWidget />)
    fireEvent.click(screen.getByLabelText('Send feedback'))
    fireEvent.click(screen.getByText('Bug Report'))
    const sendBtn = screen.getByText('Send')
    expect(sendBtn).toBeDisabled()
  })
})
