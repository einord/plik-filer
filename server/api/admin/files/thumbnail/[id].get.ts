import { createReadStream, existsSync } from 'fs'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Invalid file ID' })

  const db = useDb()
  const [file] = await db.select().from(files)
    .where(eq(files.id, id))
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
