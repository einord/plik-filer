import { eq } from 'drizzle-orm'
import { users } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { token, email, password } = body

  if (!token || !email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'All fields are required' })
  }

  const db = useDb()

  const [user] = await db.select().from(users).where(eq(users.setupToken, token)).limit(1)

  if (!user) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid or expired setup link' })
  }

  if (user.setupTokenExpiresAt && new Date(user.setupTokenExpiresAt) < new Date()) {
    throw createError({ statusCode: 400, statusMessage: 'Setup link has expired' })
  }

  // Validate password strength
  const strength = checkPasswordStrength(password)
  if (strength.level === 'weak') {
    throw createError({ statusCode: 400, statusMessage: 'Password is too weak' })
  }

  // Check if email already exists (by another user)
  const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (existingUser && existingUser.id !== user.id) {
    throw createError({ statusCode: 400, statusMessage: 'Email already registered' })
  }

  const passwordHash = await hashPassword(password)

  // Update user with email, password, and clear setup token
  await db.update(users).set({
    email,
    passwordHash,
    setupToken: null,
    setupTokenExpiresAt: null,
    updatedAt: new Date().toISOString(),
  }).where(eq(users.id, user.id))

  // Create session (auto-login after setup)
  await createSession(event, user.id)

  return {
    success: true,
    user: {
      id: user.id,
      email,
      name: user.name,
      role: user.role,
    },
  }
})
