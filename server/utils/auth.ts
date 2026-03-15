import bcrypt from 'bcrypt'
import { nanoid } from 'nanoid'
import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { sessions, users } from '~~/server/database/schema'

const SALT_ROUNDS = 12
const SESSION_DURATION_DAYS = 30
const SESSION_COOKIE = 'plik_session'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function generateToken(length = 32): string {
  return nanoid(length)
}

export function generateSecurePassword(length = 20): string {
  const lowercase = 'abcdefghijkmnopqrstuvwxyz'
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const numbers = '23456789'
  const symbols = '!@#$%&*+-='
  const allChars = lowercase + uppercase + numbers + symbols

  let password = ''
  // Ensure at least one of each type
  password += lowercase[Math.floor(Math.random() * lowercase.length)]
  password += uppercase[Math.floor(Math.random() * uppercase.length)]
  password += numbers[Math.floor(Math.random() * numbers.length)]
  password += symbols[Math.floor(Math.random() * symbols.length)]

  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)]
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('')
}

export function checkPasswordStrength(password: string): { score: number; level: 'weak' | 'fair' | 'good' | 'strong' } {
  let score = 0

  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (password.length >= 16) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++
  // Penalize common patterns
  if (/^[a-zA-Z]+$/.test(password)) score = Math.max(0, score - 1)
  if (/^[0-9]+$/.test(password)) score = 0

  if (score <= 2) return { score, level: 'weak' }
  if (score <= 3) return { score, level: 'fair' }
  if (score <= 4) return { score, level: 'good' }
  return { score, level: 'strong' }
}

export async function createSession(event: H3Event, userId: number): Promise<string> {
  const db = useDb()
  const token = generateToken(48)
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString()

  await db.insert(sessions).values({
    userId,
    token,
    expiresAt,
  })

  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
    path: '/',
  })

  return token
}

export async function getUserSession(event: H3Event) {
  const token = getCookie(event, SESSION_COOKIE)
  if (!token) return null

  const db = useDb()
  const result = await db
    .select()
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.token, token))
    .limit(1)

  if (!result.length) return null

  const session = result[0]

  // Check expiry
  if (new Date(session.sessions.expiresAt) < new Date()) {
    await db.delete(sessions).where(eq(sessions.token, token))
    deleteCookie(event, SESSION_COOKIE)
    return null
  }

  // Check if user is active
  if (!session.users.isActive) {
    await db.delete(sessions).where(eq(sessions.token, token))
    deleteCookie(event, SESSION_COOKIE)
    return null
  }

  return {
    session: session.sessions,
    user: session.users,
  }
}

export async function destroySession(event: H3Event) {
  const token = getCookie(event, SESSION_COOKIE)
  if (token) {
    const db = useDb()
    await db.delete(sessions).where(eq(sessions.token, token))
    deleteCookie(event, SESSION_COOKIE)
  }
}

export async function requireAuth(event: H3Event) {
  const session = await getUserSession(event)
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  return session
}

export async function requireAdmin(event: H3Event) {
  const session = await requireAuth(event)
  if (session.user.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  return session
}

export async function isSetupComplete(): Promise<boolean> {
  const db = useDb()
  const adminUsers = await db
    .select()
    .from(users)
    .where(eq(users.role, 'admin'))
    .limit(1)
  return adminUsers.length > 0
}
