import { eq, and, isNull } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)

  if (!session.user.canWrite) {
    throw createError({ statusCode: 403, statusMessage: 'Write access not permitted' })
  }

  const body = await readBody(event)
  const { name, parentId } = body

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Folder name is required' })
  }

  const folderName = sanitizeFilename(name)
  const db = useDb()

  // Check for duplicate folder name in same parent
  const existing = await db.select().from(files)
    .where(
      parentId
        ? and(eq(files.userId, session.user.id), eq(files.filename, folderName), eq(files.parentId, parentId), eq(files.isDirectory, true))
        : and(eq(files.userId, session.user.id), eq(files.filename, folderName), isNull(files.parentId), eq(files.isDirectory, true))
    )
    .limit(1)

  if (existing.length > 0) {
    throw createError({ statusCode: 409, statusMessage: 'Folder already exists' })
  }

  const [folder] = await db.insert(files).values({
    userId: session.user.id,
    filename: folderName,
    path: folderName,
    size: 0,
    isDirectory: true,
    parentId: parentId || null,
  }).returning()

  return { success: true, folder }
})
