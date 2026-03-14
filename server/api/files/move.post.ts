import { eq, and, inArray } from 'drizzle-orm'
import { files } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)

  if (!session.user.canWrite) {
    throw createError({ statusCode: 403, statusMessage: 'Write access not permitted' })
  }

  const { fileIds, targetParentId } = await readBody<{ fileIds: number[], targetParentId: number | null }>(event)

  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'fileIds must be a non-empty array' })
  }

  const db = useDb()
  const userId = session.user.id

  // Validate target folder if not root
  if (targetParentId !== null && targetParentId !== undefined) {
    const [targetFolder] = await db.select().from(files)
      .where(and(eq(files.id, targetParentId), eq(files.userId, userId), eq(files.isDirectory, true)))
      .limit(1)

    if (!targetFolder) {
      throw createError({ statusCode: 404, statusMessage: 'Target folder not found' })
    }

    // Don't allow moving a folder into itself
    if (fileIds.includes(targetParentId)) {
      throw createError({ statusCode: 400, statusMessage: 'Cannot move a folder into itself' })
    }
  }

  // Validate all files belong to the user
  const userFiles = await db.select({ id: files.id }).from(files)
    .where(and(inArray(files.id, fileIds), eq(files.userId, userId)))

  if (userFiles.length !== fileIds.length) {
    throw createError({ statusCode: 404, statusMessage: 'One or more files not found' })
  }

  // Move files
  await db.update(files)
    .set({ parentId: targetParentId ?? null })
    .where(and(inArray(files.id, fileIds), eq(files.userId, userId)))

  return { success: true }
})
