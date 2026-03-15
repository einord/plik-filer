import { createReadStream, existsSync } from 'fs'
import { join } from 'path'
import { eq } from 'drizzle-orm'
import archiver from 'archiver'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!token) throw createError({ statusCode: 400, statusMessage: 'Token is required' })

  const db = useDb()

  const [link] = await db.select().from(shareLinks)
    .where(eq(shareLinks.token, token))
    .limit(1)

  if (!link || !link.isActive || new Date(link.expiresAt) < new Date()) {
    throw createError({ statusCode: 410, statusMessage: 'Share link has expired' })
  }

  const linkFiles = await db.select({ file: files })
    .from(shareLinkFiles)
    .innerJoin(files, eq(shareLinkFiles.fileId, files.id))
    .where(eq(shareLinkFiles.shareLinkId, link.id))

  if (linkFiles.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'No files found' })
  }

  const zipName = link.label
    ? `${link.label.replace(/[^a-zA-Z0-9_-]/g, '_')}.zip`
    : `plik-filer-${Date.now()}.zip`

  setHeaders(event, {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="${encodeURIComponent(zipName)}"`,
  })

  const archive = archiver('zip', { zlib: { level: 5 } })

  for (const lf of linkFiles) {
    const file = lf.file
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
