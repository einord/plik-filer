import { eq, and, isNull } from 'drizzle-orm'
import { files, users } from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const userId = Number(getRouterParam(event, 'userId'))
  if (!userId) throw createError({ statusCode: 400, statusMessage: 'Invalid user ID' })

  const db = useDb()

  const [targetUser] = await db.select().from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!targetUser) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  const body = await readBody(event)
  const { name, parentId } = body

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Folder name is required' })
  }

  const folderName = sanitizeFilename(name)

  // Check for duplicate folder name in same parent
  const existing = await db.select().from(files)
    .where(
      parentId
        ? and(eq(files.userId, userId), eq(files.filename, folderName), eq(files.parentId, parentId), eq(files.isDirectory, true))
        : and(eq(files.userId, userId), eq(files.filename, folderName), isNull(files.parentId), eq(files.isDirectory, true))
    )
    .limit(1)

  if (existing.length > 0) {
    throw createError({ statusCode: 409, statusMessage: 'Folder already exists' })
  }

  const [folder] = await db.insert(files).values({
    userId,
    filename: folderName,
    path: folderName,
    size: 0,
    isDirectory: true,
    parentId: parentId || null,
  }).returning()

  return { success: true, folder }
})
