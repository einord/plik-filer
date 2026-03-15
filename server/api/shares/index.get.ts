import { eq } from 'drizzle-orm'
import { shareLinks, shareLinkFiles, files } from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)

  const db = useDb()
  const userLinks = await db.select().from(shareLinks)
    .where(eq(shareLinks.createdBy, session.user.id))
    .orderBy(shareLinks.createdAt)

  // Fetch associated files for each link
  const linksWithFiles = await Promise.all(
    userLinks.map(async (link) => {
      const linkFiles = await db.select({ file: files })
        .from(shareLinkFiles)
        .innerJoin(files, eq(shareLinkFiles.fileId, files.id))
        .where(eq(shareLinkFiles.shareLinkId, link.id))

      return {
        ...link,
        isExpired: new Date(link.expiresAt) < new Date(),
        files: linkFiles.map((lf) => lf.file),
      }
    }),
  )

  return { shareLinks: linksWithFiles }
})
