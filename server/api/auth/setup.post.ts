import { eq } from 'drizzle-orm'
import { users } from '#db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { token, email, password } = body

  if (!token || !email) {
    throw createError({ statusCode: 400, statusMessage: 'Email is required' })
  }

  const db = useDb()

  const [user] = await db.select().from(users).where(eq(users.setupToken, token)).limit(1)

  if (!user) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid or expired setup link' })
  }

  if (user.setupTokenExpiresAt && new Date(user.setupTokenExpiresAt) < new Date()) {
    throw createError({ statusCode: 400, statusMessage: 'Setup link has expired' })
  }

  // Validate password strength (only if password provided)
  let passwordHash = null
  if (password) {
    const strength = checkPasswordStrength(password)
    if (strength.level === 'weak') {
      throw createError({ statusCode: 400, statusMessage: 'Password is too weak' })
    }
    passwordHash = await hashPassword(password)
  }

  // Check if email already exists (by another user)
  const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (existingUser && existingUser.id !== user.id) {
    throw createError({ statusCode: 400, statusMessage: 'Email already registered' })
  }

  // Update user with email, optionally password, and clear setup token
  await db.update(users).set({
    email,
    ...(passwordHash ? { passwordHash } : {}),
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
