import { createReadStream, existsSync } from 'fs'
import { join } from 'path'
import { eq, and, inArray } from 'drizzle-orm'
import archiver from 'archiver'
import { files } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)

  if (!session.user.canRead) {
    throw createError({ statusCode: 403, statusMessage: 'Read access not permitted' })
  }

  const body = await readBody(event)
  const { fileIds } = body

  if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No files selected' })
  }

  const db = useDb()
  const selectedFiles = await db.select().from(files)
    .where(and(
      inArray(files.id, fileIds),
      eq(files.userId, session.user.id),
    ))

  if (selectedFiles.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'No files found' })
  }

  const userDir = getUserDir(session.user.id)

  setHeaders(event, {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="plik-filer-${Date.now()}.zip"`,
  })

  const archive = archiver('zip', { zlib: { level: 5 } })

  // Add files to archive
  for (const file of selectedFiles) {
    if (file.isDirectory) continue
    const fullPath = join(userDir, file.path)
    if (existsSync(fullPath)) {
      archive.file(fullPath, { name: file.filename })
    }
  }

  archive.finalize()

  return archive
})
