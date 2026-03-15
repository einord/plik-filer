import { eq, and, sum, count } from 'drizzle-orm'
import { files } from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)

  const db = useDb()
  const userId = session.user.id

  // Query total files count and total storage used
  const [stats] = await db
    .select({
      totalFiles: count(),
      totalUsed: sum(files.size),
    })
    .from(files)
    .where(and(eq(files.userId, userId), eq(files.isDirectory, false)))

  const totalUsed = Number(stats?.totalUsed || 0)
  const maxAllowed = session.user.maxFileSize
  const percentage = maxAllowed > 0 ? Math.round((totalUsed / maxAllowed) * 100) : 0

  return {
    totalFiles: stats?.totalFiles || 0,
    totalUsed,
    maxAllowed,
    percentage,
  }
})
