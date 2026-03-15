import { eq, and, inArray } from 'drizzle-orm'
import { shareLinks, shareLinkFiles, files } from '#db'

/**
 * Recursively collects all non-directory file IDs inside a folder.
 */
async function getFilesInFolder(db: any, folderId: number, userId: number): Promise<number[]> {
  const children = await db.select().from(files)
    .where(and(eq(files.parentId, folderId), eq(files.userId, userId)))

  const result: number[] = []
  for (const child of children) {
    if (child.isDirectory) {
      const nested = await getFilesInFolder(db, child.id, userId)
      result.push(...nested)
    } else {
      result.push(child.id)
    }
  }
  return result
}

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

  // Expand directories: replace folder IDs with their contained file IDs
  const resolvedFileIds: number[] = []
  for (const file of userFiles) {
    if (file.isDirectory) {
      const nestedIds = await getFilesInFolder(db, file.id, session.user.id)
      resolvedFileIds.push(...nestedIds)
    } else {
      resolvedFileIds.push(file.id)
    }
  }

  if (resolvedFileIds.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No files to share (folders may be empty)' })
  }

  // Deduplicate
  const uniqueFileIds = [...new Set(resolvedFileIds)]

  const token = generateToken(24)
  const expiresAt = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000).toISOString()

  const [link] = await db.insert(shareLinks).values({
    createdBy: session.user.id,
    token,
    label: label || null,
    expiresAt,
  }).returning()

  // Associate resolved files with the share link
  for (const fileId of uniqueFileIds) {
    await db.insert(shareLinkFiles).values({
      shareLinkId: link.id,
      fileId,
    })
  }

  const config = useRuntimeConfig()
  const origin = config.origin || 'http://localhost:3000'
  const shareUrl = `${origin}/share/${token}`

  // Fetch the actual files for the response
  const sharedFiles = await db.select().from(files)
    .where(inArray(files.id, uniqueFileIds))

  return {
    success: true,
    shareLink: {
      ...link,
      url: shareUrl,
      files: sharedFiles,
    },
  }
})
