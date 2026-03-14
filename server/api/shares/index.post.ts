import { eq, and, inArray } from 'drizzle-orm'
import { shareLinks, shareLinkFiles, files } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const body = await readBody(event)
  const { fileIds, label, daysValid = 7 } = body

  if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Select at least one file' })
  }

  // Verify all files belong to the user
  const db = useDb()
  const userFiles = await db.select().from(files)
    .where(and(
      inArray(files.id, fileIds),
      eq(files.userId, session.user.id),
    ))

  if (userFiles.length !== fileIds.length) {
    throw createError({ statusCode: 403, statusMessage: 'Some files are not accessible' })
  }

  const token = generateToken(24)
  const expiresAt = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000).toISOString()

  const [link] = await db.insert(shareLinks).values({
    createdBy: session.user.id,
    token,
    label: label || null,
    expiresAt,
  }).returning()

  // Associate files with the share link
  for (const fileId of fileIds) {
    await db.insert(shareLinkFiles).values({
      shareLinkId: link.id,
      fileId,
    })
  }

  const config = useRuntimeConfig()
  const origin = config.origin || 'http://localhost:3000'
  const shareUrl = `${origin}/share/${token}`

  return {
    success: true,
    shareLink: {
      ...link,
      url: shareUrl,
      files: userFiles,
    },
  }
})
