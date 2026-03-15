import { eq } from 'drizzle-orm'
import { join } from 'path'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Invalid file ID' })

  const db = useDb()
  const [file] = await db.select().from(files)
    .where(eq(files.id, id))
    .limit(1)

  if (!file) {
    throw createError({ statusCode: 404, statusMessage: 'File not found' })
  }

  if (!file.isDirectory && file.storageName) {
    const userDir = getUserDir(file.userId)
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
