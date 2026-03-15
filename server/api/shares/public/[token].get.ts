import { eq } from 'drizzle-orm'
import { shareLinks, shareLinkFiles, files } from '#db'

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  if (!token) throw createError({ statusCode: 400, statusMessage: 'Invalid token' })

  const db = useDb()
  const [link] = await db.select().from(shareLinks)
    .where(eq(shareLinks.token, token))
    .limit(1)

  if (!link) {
    throw createError({ statusCode: 404, statusMessage: 'Share link not found' })
  }

  if (!link.isActive || new Date(link.expiresAt) < new Date()) {
    throw createError({ statusCode: 410, statusMessage: 'Share link has expired' })
  }

  const linkFiles = await db.select({ file: files })
    .from(shareLinkFiles)
    .innerJoin(files, eq(shareLinkFiles.fileId, files.id))
    .where(eq(shareLinkFiles.shareLinkId, link.id))

  return {
    label: link.label,
    expiresAt: link.expiresAt,
    files: linkFiles.map((lf) => ({
      id: lf.file.id,
      filename: lf.file.filename,
      size: lf.file.size,
      mimeType: lf.file.mimeType,
      hasThumbnail: !!lf.file.thumbnailPath,
    })),
  }
})
