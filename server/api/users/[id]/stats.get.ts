import { eq, and, sum, count } from 'drizzle-orm'
import { files, users } from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Invalid user ID' })

  const db = useDb()

  // Fetch the user to get maxFileSize
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  // Query total files count and total storage used
  const [stats] = await db
    .select({
      totalFiles: count(),
      totalUsed: sum(files.size),
    })
    .from(files)
    .where(and(eq(files.userId, id), eq(files.isDirectory, false)))

  return {
    totalFiles: stats?.totalFiles || 0,
    totalUsed: Number(stats?.totalUsed || 0),
    maxFileSize: user.maxFileSize,
  }
})
