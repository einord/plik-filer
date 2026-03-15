import { createReadStream, existsSync } from 'fs'
import { eq, and } from 'drizzle-orm'

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

  if (!linkFile || !linkFile.file.thumbnailPath) {
    throw createError({ statusCode: 404, statusMessage: 'Thumbnail not found' })
  }

  if (!existsSync(linkFile.file.thumbnailPath)) {
    throw createError({ statusCode: 404, statusMessage: 'Thumbnail file not found' })
  }

  setHeaders(event, {
    'Content-Type': 'image/jpeg',
    'Cache-Control': 'public, max-age=86400',
  })

  return sendStream(event, createReadStream(linkFile.file.thumbnailPath))
})
