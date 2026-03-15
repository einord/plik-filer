import { eq, and } from 'drizzle-orm'
import { shareLinks } from '#db'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))

  if (!id) throw createError({ statusCode: 400, statusMessage: 'Invalid share link ID' })

  const db = useDb()

  // Admin can delete any, users can only delete their own
  const conditions = session.user.role === 'admin'
    ? eq(shareLinks.id, id)
    : and(eq(shareLinks.id, id), eq(shareLinks.createdBy, session.user.id))

  const result = await db.delete(shareLinks).where(conditions)

  return { success: true }
})
