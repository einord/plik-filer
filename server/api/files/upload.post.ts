import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { eq, and, sum } from 'drizzle-orm'
import { files } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)

  if (!session.user.canWrite) {
    throw createError({ statusCode: 403, statusMessage: 'Write access not permitted' })
  }

  const formData = await readMultipartFormData(event)
  if (!formData) {
    throw createError({ statusCode: 400, statusMessage: 'No files uploaded' })
  }

  const db = useDb()
  const userDir = getUserDir(session.user.id)
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
    .where(and(eq(files.userId, session.user.id), eq(files.isDirectory, false)))

  const currentUsage = Number(storageResult?.totalUsed || 0)
  if (currentUsage + totalNewSize > session.user.maxFileSize) {
    throw createError({
      statusCode: 413,
      statusMessage: `Upload exceeds your storage quota. Used: ${formatFileSize(currentUsage)}, Limit: ${formatFileSize(session.user.maxFileSize)}`,
    })
  }

  const uploadedFiles = []

  for (const file of formData) {
    if (file.name !== 'files' || !file.filename) continue

    const filename = sanitizeFilename(file.filename)
    const fileSize = file.data.length

    // Check individual file size limit
    if (fileSize > session.user.maxFileSize) {
      throw createError({
        statusCode: 413,
        statusMessage: `File ${filename} exceeds size limit of ${formatFileSize(session.user.maxFileSize)}`,
      })
    }

    const storageName = generateStorageName()
    const filePath = join(userDir, storageName)
    const relativePath = parentId ? join(targetDir.replace(userDir, ''), filename) : filename

    writeFileSync(filePath, file.data)

    // Generate thumbnail
    const mimeType = getMimeType(filename)
    let thumbnailPath = null
    if (isImageFile(filename) || isVideoFile(filename)) {
      thumbnailPath = await generateThumbnail(session.user.id, filePath, filename)
    }

    const [inserted] = await db.insert(files).values({
      userId: session.user.id,
      filename,
      storageName,
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
