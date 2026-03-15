import { eq, count, sum, desc, and } from 'drizzle-orm'
import { files, users, shareLinks } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const db = useDb()

  // Total and active user counts
  const [totalUsersResult] = await db
    .select({ value: count() })
    .from(users)

  const [activeUsersResult] = await db
    .select({ value: count() })
    .from(users)
    .where(eq(users.isActive, true))

  // Total non-directory files and total storage
  const [fileStatsResult] = await db
    .select({
      totalFiles: count(),
      totalStorage: sum(files.size),
    })
    .from(files)
    .where(eq(files.isDirectory, false))

  // Active share links count
  const [shareLinksResult] = await db
    .select({ value: count() })
    .from(shareLinks)
    .where(eq(shareLinks.isActive, true))

  // Recent 10 uploads (non-directory) joined with users for name
  const recentUploads = await db
    .select({
      id: files.id,
      filename: files.filename,
      size: files.size,
      mimeType: files.mimeType,
      userId: files.userId,
      userName: users.name,
      createdAt: files.createdAt,
    })
    .from(files)
    .innerJoin(users, eq(files.userId, users.id))
    .where(eq(files.isDirectory, false))
    .orderBy(desc(files.createdAt))
    .limit(10)

  return {
    totalUsers: totalUsersResult.value,
    activeUsers: activeUsersResult.value,
    totalFiles: fileStatsResult.totalFiles,
    totalStorage: Number(fileStatsResult.totalStorage) || 0,
    totalShareLinks: shareLinksResult.value,
    recentUploads,
  }
})
