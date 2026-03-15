import { eq } from 'drizzle-orm'
import { users } from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))

  if (!id) throw createError({ statusCode: 400, statusMessage: 'Invalid user ID' })

  // Prevent self-deletion
  if (id === session.user.id) {
    throw createError({ statusCode: 400, statusMessage: 'Cannot delete your own account' })
  }

  const db = useDb()
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  // Delete user directory and all files
  deleteDirectory(getUserDir(id))

  // Delete user from database (cascades to files, sessions, etc.)
  await db.delete(users).where(eq(users.id, id))

  return { success: true }
})
