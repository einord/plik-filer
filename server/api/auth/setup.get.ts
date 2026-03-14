import { eq } from 'drizzle-orm'
import { users } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const token = query.token as string

  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'Token is required' })
  }

  const db = useDb()

  const [user] = await db.select().from(users).where(eq(users.setupToken, token)).limit(1)

  if (!user) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid or expired setup link' })
  }

  if (user.setupTokenExpiresAt && new Date(user.setupTokenExpiresAt) < new Date()) {
    throw createError({ statusCode: 400, statusMessage: 'Setup link has expired' })
  }

  return {
    name: user.name,
    email: user.email,
  }
})
