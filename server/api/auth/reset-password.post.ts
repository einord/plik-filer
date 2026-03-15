import { eq } from 'drizzle-orm'
import { users, passwordResets } from '#db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { token, password } = body

  if (!token || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Token and password are required' })
  }

  const strength = checkPasswordStrength(password)
  if (strength.level === 'weak') {
    throw createError({ statusCode: 400, statusMessage: 'Password is too weak' })
  }

  const db = useDb()
  const [reset] = await db.select().from(passwordResets).where(eq(passwordResets.token, token)).limit(1)

  if (!reset) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid or expired reset token' })
  }

  if (reset.usedAt) {
    throw createError({ statusCode: 400, statusMessage: 'Reset token already used' })
  }

  if (new Date(reset.expiresAt) < new Date()) {
    throw createError({ statusCode: 400, statusMessage: 'Reset token has expired' })
  }

  const passwordHash = await hashPassword(password)

  await db.update(users).set({
    passwordHash,
    updatedAt: new Date().toISOString(),
  }).where(eq(users.id, reset.userId))

  await db.update(passwordResets).set({
    usedAt: new Date().toISOString(),
  }).where(eq(passwordResets.id, reset.id))

  return { success: true }
})
