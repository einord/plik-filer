import { createReadStream, existsSync, statSync } from 'fs'
import { join } from 'path'
import { eq, and } from 'drizzle-orm'
import { files } from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)

  if (!session.user.canRead) {
    throw createError({ statusCode: 403, statusMessage: 'Read access not permitted' })
  }

  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Invalid file ID' })

  const db = useDb()
  const [file] = await db.select().from(files)
    .where(and(eq(files.id, id), eq(files.userId, session.user.id)))
    .limit(1)

  if (!file || file.isDirectory) {
    throw createError({ statusCode: 404, statusMessage: 'File not found' })
  }

  const userDir = getUserDir(session.user.id)
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
