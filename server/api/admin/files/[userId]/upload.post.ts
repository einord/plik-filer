import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { eq, and, sum } from 'drizzle-orm'
import { files, users } from '../../../../database/schema'

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

  const formData = await readMultipartFormData(event)
  if (!formData) {
    throw createError({ statusCode: 400, statusMessage: 'No files uploaded' })
  }

  const userDir = getUserDir(userId)
  const parentIdField = formData.find((f) => f.name === 'parentId')
  const parentId = parentIdField ? Number(parentIdField.data.toString()) : null

  // Determine target directory
  let targetDir = userDir
  if (parentId) {
    const [parentFolder] = await db.select().from(files)
      .where(eq(files.id, parentId))
      .limit(1)
    if (parentFolder && parentFolder.isDirectory) {
      targetDir = join(userDir, parentFolder.path)
    }
  }

  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true })
  }

  // Calculate total size of new uploads
  const uploadFileEntries = formData.filter((f) => f.name === 'files' && f.filename)
  const totalNewSize = uploadFileEntries.reduce((acc, f) => acc + f.data.length, 0)

  // Check current storage usage against quota
  const [storageResult] = await db
    .select({ totalUsed: sum(files.size) })
    .from(files)
    .where(and(eq(files.userId, userId), eq(files.isDirectory, false)))

  const currentUsage = Number(storageResult?.totalUsed || 0)
  if (currentUsage + totalNewSize > targetUser.maxFileSize) {
    throw createError({
      statusCode: 413,
      statusMessage: `Upload exceeds user storage quota. Used: ${formatFileSize(currentUsage)}, Limit: ${formatFileSize(targetUser.maxFileSize)}`,
    })
  }

  const uploadedFiles = []

  for (const file of formData) {
    if (file.name !== 'files' || !file.filename) continue

    const filename = sanitizeFilename(file.filename)
    const fileSize = file.data.length
    const filePath = join(targetDir, filename)
    const relativePath = parentId ? join(targetDir.replace(userDir, ''), filename) : filename

    writeFileSync(filePath, file.data)

    // Generate thumbnail
    const mimeType = getMimeType(filename)
    let thumbnailPath = null
    if (isImageFile(filename) || isVideoFile(filename)) {
      thumbnailPath = await generateThumbnail(userId, filePath, filename)
    }

    const [inserted] = await db.insert(files).values({
      userId,
      filename,
      path: relativePath,
      size: fileSize,
      mimeType,
      thumbnailPath,
      isDirectory: false,
      parentId,
    }).returning()

    uploadedFiles.push(inserted)
  }

  return { success: true, files: uploadedFiles }
})
