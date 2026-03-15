import { existsSync } from 'fs'
import { join } from 'path'
import { eq, and, isNull } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)

  if (!session.user.canRead) {
    throw createError({ statusCode: 403, statusMessage: 'Read access not permitted' })
  }

  const query = getQuery(event)
  const parentId = query.parentId ? Number(query.parentId) : null

  // Sync new files from disk when listing root folder
  if (!parentId) {
    await syncUserFiles(session.user.id)
  }

  const db = useDb()

  const whereConditions = parentId
    ? and(eq(files.userId, session.user.id), eq(files.parentId, parentId))
    : and(eq(files.userId, session.user.id), isNull(files.parentId))

  const userFiles = await db.select().from(files)
    .where(whereConditions)
    .orderBy(files.isDirectory, files.filename)

  // Check if files exist on disk, flag missing ones
  const userDir = getUserDir(session.user.id)
  const filesWithStatus = userFiles.map(file => {
    if (file.isDirectory || !file.storageName) return file
    const fullPath = join(userDir, file.storageName)
    return { ...file, missing: !existsSync(fullPath) }
  })

  return { files: filesWithStatus }
})
