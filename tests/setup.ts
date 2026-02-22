// Global test setup for Vitest + jsdom
// Runs before every test file

import { afterEach, vi } from 'vitest'
import '@testing-library/jest-dom'

// Reset mocks between tests automatically
afterEach(() => {
  vi.clearAllMocks()
})
