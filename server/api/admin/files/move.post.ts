import { eq, inArray } from 'drizzle-orm'
import { files } from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const { fileIds, targetParentId } = await readBody<{ fileIds: number[], targetParentId: number | null }>(event)

  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'fileIds must be a non-empty array' })
  }

  const db = useDb()

  // Validate target folder if not root
  if (targetParentId !== null && targetParentId !== undefined) {
    const [targetFolder] = await db.select().from(files)
      .where(eq(files.id, targetParentId))
      .limit(1)

    if (!targetFolder || !targetFolder.isDirectory) {
      throw createError({ statusCode: 404, statusMessage: 'Target folder not found' })
    }

    // Don't allow moving a folder into itself
    if (fileIds.includes(targetParentId)) {
      throw createError({ statusCode: 400, statusMessage: 'Cannot move a folder into itself' })
    }
  }

  // Validate all files exist
  const existingFiles = await db.select({ id: files.id }).from(files)
    .where(inArray(files.id, fileIds))

  if (existingFiles.length !== fileIds.length) {
    throw createError({ statusCode: 404, statusMessage: 'One or more files not found' })
  }

  // Move files
  await db.update(files)
    .set({ parentId: targetParentId ?? null })
    .where(inArray(files.id, fileIds))

  return { success: true }
})
