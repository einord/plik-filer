import { createReadStream, existsSync } from 'fs'
import { eq, and } from 'drizzle-orm'
import { files } from '#db'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))

  if (!id) throw createError({ statusCode: 400, statusMessage: 'Invalid file ID' })

  const db = useDb()
  const [file] = await db.select().from(files)
    .where(and(eq(files.id, id), eq(files.userId, session.user.id)))
    .limit(1)

  if (!file || !file.thumbnailPath) {
    throw createError({ statusCode: 404, statusMessage: 'Thumbnail not found' })
  }

  if (!existsSync(file.thumbnailPath)) {
    throw createError({ statusCode: 404, statusMessage: 'Thumbnail file not found' })
  }

  setHeaders(event, {
    'Content-Type': 'image/jpeg',
    'Cache-Control': 'public, max-age=86400',
  })

  return sendStream(event, createReadStream(file.thumbnailPath))
})
