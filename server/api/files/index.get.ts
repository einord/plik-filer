import { eq, and, isNull } from 'drizzle-orm'
import { files } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)

  if (!session.user.canRead) {
    throw createError({ statusCode: 403, statusMessage: 'Read access not permitted' })
  }

  const query = getQuery(event)
  const parentId = query.parentId ? Number(query.parentId) : null

  const db = useDb()

  const whereConditions = parentId
    ? and(eq(files.userId, session.user.id), eq(files.parentId, parentId))
    : and(eq(files.userId, session.user.id), isNull(files.parentId))

  const userFiles = await db.select().from(files)
    .where(whereConditions)
    .orderBy(files.isDirectory, files.filename)

  return { files: userFiles }
})
