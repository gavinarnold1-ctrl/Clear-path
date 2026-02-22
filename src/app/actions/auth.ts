'use server'

import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { hashPassword, verifyPassword } from '@/lib/password'
import { setSession, clearSession } from '@/lib/session'

interface AuthState {
  error: string | null
}

export async function register(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const name = (formData.get('name') as string)?.trim() || null
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const password = formData.get('password') as string

  if (!email || !password) return { error: 'Email and password are required.' }
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) return { error: 'An account with this email already exists.' }

  const user = await db.user.create({
    data: {
      email,
      name,
      password: await hashPassword(password),
      profile: { create: {} }, // creates UserProfile with onboardingCompleted=false
    },
  })

  await setSession({ userId: user.id, email: user.email, name: user.name })
  redirect('/onboarding')
}

export async function login(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const password = formData.get('password') as string

  if (!email || !password) return { error: 'Email and password are required.' }

  const user = await db.user.findUnique({ where: { email } })
  if (!user || !(await verifyPassword(password, user.password))) {
    return { error: 'Invalid email or password.' }
  }

  await setSession({ userId: user.id, email: user.email, name: user.name })
  redirect('/dashboard')
}

export async function logout() {
  await clearSession()
  redirect('/login')
}
