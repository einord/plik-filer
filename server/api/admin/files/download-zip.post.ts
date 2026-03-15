import { existsSync } from 'fs'
import { join } from 'path'
import { eq, inArray } from 'drizzle-orm'
import archiver from 'archiver'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readBody(event)
  const { fileIds } = body

  if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No files selected' })
  }

  const db = useDb()
  const selectedFiles = await db.select().from(files)
    .where(inArray(files.id, fileIds))

  if (selectedFiles.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'No files found' })
  }

  setHeaders(event, {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="plik-filer-${Date.now()}.zip"`,
  })

  const archive = archiver('zip', { zlib: { level: 5 } })

  // Add files to archive
  for (const file of selectedFiles) {
    if (file.isDirectory) continue
    const userDir = getUserDir(file.userId)
    if (!file.storageName) continue
    const fullPath = join(userDir, file.storageName)
    if (existsSync(fullPath)) {
      archive.file(fullPath, { name: file.filename })
    }
  }

  archive.finalize()

  return archive
})
