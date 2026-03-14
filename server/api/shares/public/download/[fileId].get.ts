import { createReadStream, existsSync, statSync } from 'fs'
import { join } from 'path'
import { eq, and } from 'drizzle-orm'
import { shareLinks, shareLinkFiles, files } from '../../../../database/schema'

export default defineEventHandler(async (event) => {
  const fileId = Number(getRouterParam(event, 'fileId'))
  const query = getQuery(event)
  const token = query.token as string

  if (!fileId || !token) {
    throw createError({ statusCode: 400, statusMessage: 'File ID and token are required' })
  }

  const db = useDb()

  // Validate the share link
  const [link] = await db.select().from(shareLinks)
    .where(eq(shareLinks.token, token))
    .limit(1)

  if (!link || !link.isActive || new Date(link.expiresAt) < new Date()) {
    throw createError({ statusCode: 410, statusMessage: 'Share link has expired' })
  }

  // Verify the file belongs to this share link
  const [linkFile] = await db.select({ file: files })
    .from(shareLinkFiles)
    .innerJoin(files, eq(shareLinkFiles.fileId, files.id))
    .where(and(
      eq(shareLinkFiles.shareLinkId, link.id),
      eq(shareLinkFiles.fileId, fileId),
    ))
    .limit(1)

  if (!linkFile) {
    throw createError({ statusCode: 404, statusMessage: 'File not found in share link' })
  }

  const file = linkFile.file
  const userDir = getUserDir(file.userId)
  const fullPath = join(userDir, file.storageName!)

  if (!existsSync(fullPath)) {
    throw createError({ statusCode: 404, statusMessage: 'File not found on disk' })
  }

  const stat = statSync(fullPath)

  setHeaders(event, {
    'Content-Type': file.mimeType || 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${encodeURIComponent(file.filename)}"`,
    'Content-Length': String(stat.size),
  })

  return sendStream(event, createReadStream(fullPath))
})
