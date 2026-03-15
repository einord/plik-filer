import { eq } from 'drizzle-orm'
import { users } from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Invalid user ID' })

  const db = useDb()

  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  if (!user) throw createError({ statusCode: 404, statusMessage: 'User not found' })

  await db.update(users).set({
    setupToken: null,
    setupTokenExpiresAt: null,
  }).where(eq(users.id, id))

  return { success: true }
})
