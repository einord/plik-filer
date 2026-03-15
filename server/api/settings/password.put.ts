import { eq } from 'drizzle-orm'
import { users } from '#db'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const body = await readBody(event)
  const { currentPassword, newPassword } = body

  if (!newPassword) {
    throw createError({ statusCode: 400, statusMessage: 'New password is required' })
  }

  const strength = checkPasswordStrength(newPassword)
  if (strength.level === 'weak') {
    throw createError({ statusCode: 400, statusMessage: 'New password is too weak' })
  }

  const db = useDb()
  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1)

  // If user already has a password, verify current password
  if (user.passwordHash && currentPassword) {
    const valid = await verifyPassword(currentPassword, user.passwordHash)
    if (!valid) {
      throw createError({ statusCode: 401, statusMessage: 'Current password is incorrect' })
    }
  }

  const passwordHash = await hashPassword(newPassword)
  await db.update(users).set({
    passwordHash,
    updatedAt: new Date().toISOString(),
  }).where(eq(users.id, session.user.id))

  return { success: true }
})
