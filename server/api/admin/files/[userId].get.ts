import { existsSync } from 'fs'
import { join } from 'path'
import { eq, and, isNull } from 'drizzle-orm'
import { files, users } from '#db'

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

  // Sync new files from disk when listing root folder
  if (!parentId) {
    await syncUserFiles(userId)
  }

  const whereConditions = parentId
    ? and(eq(files.userId, userId), eq(files.parentId, parentId))
    : and(eq(files.userId, userId), isNull(files.parentId))

  const userFiles = await db.select().from(files)
    .where(whereConditions)
    .orderBy(files.isDirectory, files.filename)

  // Check if files exist on disk, flag missing ones
  const userDir = getUserDir(userId)
  const filesWithStatus = userFiles.map(file => {
    if (file.isDirectory || !file.storageName) return file
    const fullPath = join(userDir, file.storageName)
    return { ...file, missing: !existsSync(fullPath) }
  })

  return {
    files: filesWithStatus,
    user: {
      id: targetUser.id,
      name: targetUser.name,
      email: targetUser.email,
    },
  }
})
