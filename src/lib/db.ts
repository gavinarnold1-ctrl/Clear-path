import { PrismaClient } from '@prisma/client'

// Prevent multiple Prisma client instances in development (Next.js hot reload)
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrismaClient() {
  // Append connect_timeout for Neon cold-start resilience if not already set
  const url = process.env.DATABASE_URL ?? ''
  if (url && !url.includes('connect_timeout')) {
    const separator = url.includes('?') ? '&' : '?'
    process.env.DATABASE_URL = `${url}${separator}connect_timeout=30`
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

/**
 * Execute a database operation with retry logic for transient connection errors
 * (e.g. Neon cold starts, brief network interruptions).
 */
export async function withDbRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const isTransient =
        message.includes("Can't reach database server") ||
        message.includes('Connection timed out') ||
        message.includes('connect ETIMEDOUT') ||
        message.includes('ECONNREFUSED') ||
        message.includes('connection is not open')

      if (!isTransient || attempt === maxRetries) {
        throw error
      }

      const delay = Math.pow(2, attempt) * 1000 // 1s, 2s, 4s
      console.warn(
        `Database connection attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${delay}ms...`,
      )
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
  throw new Error('Unreachable')
}
