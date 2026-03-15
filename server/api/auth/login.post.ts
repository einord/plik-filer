import { eq } from 'drizzle-orm'
import { users } from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password } = body

  if (!email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Email and password are required' })
  }

  const db = useDb()
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)

  if (!user || !user.passwordHash) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
  }

  if (!user.isActive) {
    throw createError({ statusCode: 403, statusMessage: 'Account is deactivated' })
  }

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
  }

  await createSession(event, user.id)

  return {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      locale: user.locale,
      theme: user.theme,
    },
  }
})
