import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProgressBar from '@/components/ui/ProgressBar'

describe('ProgressBar', () => {
  it('renders a progressbar role element', () => {
    render(<ProgressBar value={50} />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('sets aria-valuenow to the (rounded) value', () => {
    render(<ProgressBar value={42} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42')
  })

  it('sets aria-valuemin="0" and aria-valuemax="100"', () => {
    render(<ProgressBar value={50} />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
  })

  it('caps aria-valuenow at 100 when value exceeds 100', () => {
    render(<ProgressBar value={150} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  })

  it('floors aria-valuenow at 0 for negative values', () => {
    render(<ProgressBar value={-20} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })

  it('fill width matches the capped percentage', () => {
    const { container } = render(<ProgressBar value={60} />)
    const fill = container.querySelector('[style]') as HTMLElement
    expect(fill.style.width).toBe('60%')
  })

  it('applies brand-500 fill color below 80%', () => {
    const { container } = render(<ProgressBar value={50} />)
    const fill = container.querySelector('[style]') as HTMLElement
    expect(fill.className).toContain('bg-brand-500')
  })

  it('applies amber-400 fill color between 80% and 99%', () => {
    const { container } = render(<ProgressBar value={85} />)
    const fill = container.querySelector('[style]') as HTMLElement
    expect(fill.className).toContain('bg-amber-400')
  })

  it('applies red-500 fill color at 100%', () => {
    const { container } = render(<ProgressBar value={100} />)
    const fill = container.querySelector('[style]') as HTMLElement
    expect(fill.className).toContain('bg-red-500')
  })

  it('applies red-500 fill color when over 100%', () => {
    const { container } = render(<ProgressBar value={120} />)
    const fill = container.querySelector('[style]') as HTMLElement
    expect(fill.className).toContain('bg-red-500')
  })

  it('accepts an optional className on the track', () => {
    const { container } = render(<ProgressBar value={50} className="mt-4" />)
    const track = container.firstChild as HTMLElement
    expect(track.className).toContain('mt-4')
  })
})
