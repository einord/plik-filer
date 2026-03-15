import { eq, desc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const isAdmin = session.user.role === 'admin'

  const db = useDb()

  // Admins see all share links, regular users see only their own
  const allLinks = isAdmin
    ? await db.select().from(shareLinks).orderBy(desc(shareLinks.createdAt))
    : await db.select().from(shareLinks)
        .where(eq(shareLinks.createdBy, session.user.id))
        .orderBy(desc(shareLinks.createdAt))

  // Get user names for admin view
  let userMap: Record<number, string> = {}
  if (isAdmin) {
    const allUsers = await db.select({ id: users.id, name: users.name }).from(users)
    userMap = Object.fromEntries(allUsers.map(u => [u.id, u.name]))
  }

  // Fetch associated files for each link
  const linksWithFiles = await Promise.all(
    allLinks.map(async (link) => {
      const linkFiles = await db.select({ file: files })
        .from(shareLinkFiles)
        .innerJoin(files, eq(shareLinkFiles.fileId, files.id))
        .where(eq(shareLinkFiles.shareLinkId, link.id))

      return {
        ...link,
        isExpired: new Date(link.expiresAt) < new Date(),
        files: linkFiles.map((lf) => lf.file),
        createdByName: isAdmin ? userMap[link.createdBy] || null : null,
      }
    }),
  )

  return { shareLinks: linksWithFiles }
})
