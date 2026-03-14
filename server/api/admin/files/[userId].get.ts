import { eq, and, isNull } from 'drizzle-orm'
import { files, users } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const userId = Number(getRouterParam(event, 'userId'))
  if (!userId) throw createError({ statusCode: 400, statusMessage: 'Invalid user ID' })

  const db = useDb()

  // Validate that the target user exists
  const [targetUser] = await db.select().from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!targetUser) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  const query = getQuery(event)
  const parentId = query.parentId ? Number(query.parentId) : null

  const whereConditions = parentId
    ? and(eq(files.userId, userId), eq(files.parentId, parentId))
    : and(eq(files.userId, userId), isNull(files.parentId))

  const userFiles = await db.select().from(files)
    .where(whereConditions)
    .orderBy(files.isDirectory, files.filename)

  return {
    files: userFiles,
    user: {
      id: targetUser.id,
      name: targetUser.name,
      email: targetUser.email,
    },
  }
})
