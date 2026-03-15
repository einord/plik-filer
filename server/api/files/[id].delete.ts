import { eq, and } from 'drizzle-orm'
import { join } from 'path'
import { files } from '#db'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)

  if (!session.user.canWrite) {
    throw createError({ statusCode: 403, statusMessage: 'Write access not permitted' })
  }

  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Invalid file ID' })

  const db = useDb()
  const [file] = await db.select().from(files)
    .where(and(eq(files.id, id), eq(files.userId, session.user.id)))
    .limit(1)

  if (!file) {
    throw createError({ statusCode: 404, statusMessage: 'File not found' })
  }

  if (!file.isDirectory && file.storageName) {
    const userDir = getUserDir(session.user.id)
    const fullPath = join(userDir, file.storageName)
    deleteFile(fullPath)
    if (file.thumbnailPath) {
      deleteFile(file.thumbnailPath)
    }
  }

  // Database cascade handles child files for directories
  await db.delete(files).where(eq(files.id, id))

  return { success: true }
})
