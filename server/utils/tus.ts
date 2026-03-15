import { Server, EVENTS } from '@tus/server'
import { FileStore } from '@tus/file-store'
import { join } from 'path'
import { existsSync, mkdirSync, renameSync, statSync, unlinkSync } from 'fs'
import { eq, and, sum } from 'drizzle-orm'
import { files } from '#db'

const TUS_UPLOAD_DIR = '.tus-uploads'
const DEFAULT_MAX_SIZE = 107_374_182_400 // 100 GB

/**
 * Returns the absolute path for the tus temporary upload directory.
 */
function getTusDir(): string {
  const dir = join(getDataPath(), TUS_UPLOAD_DIR)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

let tusServer: InstanceType<typeof Server> | null = null

/**
 * Returns a singleton tus Server instance, creating it on first call.
 */
export function getTusServer(): InstanceType<typeof Server> {
  if (tusServer) return tusServer

  const tusDir = getTusDir()

  tusServer = new Server({
    path: '/api/tus',
    datastore: new FileStore({ directory: tusDir }),
    maxSize: DEFAULT_MAX_SIZE,
    respectForwardedHeaders: true,
    allowedCredentials: true,
    allowedHeaders: ['Authorization', 'Cookie', 'X-Requested-With', 'Content-Type', 'Upload-Offset', 'Upload-Length', 'Upload-Metadata', 'Tus-Resumable', 'Upload-Concat', 'Upload-Defer-Length'],
    relativeLocation: true,
    async onUploadCreate(req, upload) {
      const cookieHeader = req.headers.get('cookie') || ''
      const authUser = await validateTusAuth(cookieHeader)

      if (authUser && upload.size) {
        const db = useDb()
        const [storageResult] = await db
          .select({ totalUsed: sum(files.size) })
          .from(files)
          .where(and(eq(files.userId, authUser.id), eq(files.isDirectory, false)))

        const currentUsage = Number(storageResult?.totalUsed || 0)
        if (currentUsage + upload.size > authUser.maxFileSize) {
          throw {
            status_code: 413,
            body: `Upload exceeds your storage quota. Used: ${formatFileSize(currentUsage)}, Limit: ${formatFileSize(authUser.maxFileSize)}`,
          }
        }
      }

      return { metadata: upload.metadata }
    },
    async onUploadFinish(req, upload) {
      const cookieHeader = req.headers.get('cookie') || ''
      const sessionToken = extractTusCookie(cookieHeader, 'plik_session')

      if (!sessionToken) {
        throw { status_code: 401, body: 'Unauthorized' }
      }

      const db = useDb()

      const { sessions, users } = await import('../database/schema')
      const result = await db
        .select()
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(eq(sessions.token, sessionToken))
        .limit(1)

      if (!result.length) {
        throw { status_code: 401, body: 'Unauthorized' }
      }

      const session = result[0]

      if (new Date(session.sessions.expiresAt) < new Date()) {
        throw { status_code: 401, body: 'Session expired' }
      }

      if (!session.users.isActive) {
        throw { status_code: 403, body: 'User inactive' }
      }
      if (!session.users.canWrite) {
        throw { status_code: 403, body: 'Write access not permitted' }
      }

      const user = session.users

      const originalFilename = upload.metadata?.filename || `upload_${Date.now()}`
      const parentIdStr = upload.metadata?.parentId
      const filetype = upload.metadata?.filetype || undefined
      const targetUserIdStr = upload.metadata?.targetUserId

      // Allow admins to upload on behalf of another user
      let targetUserId = user.id
      if (targetUserIdStr && user.role === 'admin') {
        targetUserId = Number(targetUserIdStr)
      }

      const filename = sanitizeFilename(originalFilename)
      const parentId = parentIdStr ? Number(parentIdStr) : null

      // Look up target user's quota if uploading for another user
      let targetUser = user
      if (targetUserId !== user.id) {
        const [tu] = await db.select().from(users)
          .where(eq(users.id, targetUserId))
          .limit(1)
        if (!tu) {
          throw { status_code: 404, body: 'Target user not found' }
        }
        targetUser = tu
      }

      const fileSize = upload.size || upload.offset
      if (fileSize > targetUser.maxFileSize) {
        throw {
          status_code: 413,
          body: `File ${filename} exceeds size limit of ${formatFileSize(targetUser.maxFileSize)}`,
        }
      }

      // Safety net: check total storage quota
      const [storageCheck] = await db
        .select({ totalUsed: sum(files.size) })
        .from(files)
        .where(and(eq(files.userId, targetUserId), eq(files.isDirectory, false)))

      const currentUsage = Number(storageCheck?.totalUsed || 0)
      if (currentUsage + fileSize > targetUser.maxFileSize) {
        throw {
          status_code: 413,
          body: `Upload exceeds storage quota. Used: ${formatFileSize(currentUsage)}, Limit: ${formatFileSize(targetUser.maxFileSize)}`,
        }
      }

      // Determine target directory
      const userDir = getUserDir(targetUserId)
      let targetDir = userDir

      if (parentId) {
        const [parentFolder] = await db.select().from(files)
          .where(eq(files.id, parentId))
          .limit(1)
        if (parentFolder && parentFolder.isDirectory) {
          targetDir = join(userDir, parentFolder.path)
        }
      }

      if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true })
      }

      // Move the completed file from tus temp directory to user's directory
      const storageName = generateStorageName()
      const tusFilePath = join(getTusDir(), upload.id)
      const destFilePath = join(userDir, storageName)
      const relativePath = parentId ? join(targetDir.replace(userDir, ''), filename) : filename

      try {
        renameSync(tusFilePath, destFilePath)
      } catch {
        const { copyFileSync } = await import('fs')
        copyFileSync(tusFilePath, destFilePath)
        try { unlinkSync(tusFilePath) } catch { /* ignore */ }
      }

      // Clean up tus metadata file
      try { unlinkSync(`${tusFilePath}.json`) } catch { /* may not exist */ }

      const actualSize = statSync(destFilePath).size

      // Generate thumbnail if applicable
      const mimeType = filetype || getMimeType(filename)
      let thumbnailPath = null
      if (isImageFile(filename) || isVideoFile(filename)) {
        thumbnailPath = await generateThumbnail(targetUserId, destFilePath, filename)
      }

      await db.insert(files).values({
        userId: targetUserId,
        filename,
        storageName,
        path: relativePath,
        size: actualSize,
        mimeType,
        thumbnailPath,
        isDirectory: false,
        parentId,
      })

      return {
        status_code: 204,
        headers: { 'X-Upload-Complete': '1' },
      }
    },
  })

  tusServer.on(EVENTS.POST_FINISH, async () => {
    try {
      await tusServer?.cleanUpExpiredUploads()
    } catch { /* ignore */ }
  })

  return tusServer
}

/**
 * Extracts a specific cookie value from a cookie header string.
 */
function extractTusCookie(cookieHeader: string, name: string): string | null {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

/**
 * Validates session authentication from the cookie header.
 */
export async function validateTusAuth(cookieHeader: string) {
  const sessionToken = extractTusCookie(cookieHeader, 'plik_session')
  if (!sessionToken) {
    return null
  }

  const db = useDb()
  const { sessions, users } = await import('../database/schema')

  const result = await db
    .select()
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.token, sessionToken))
    .limit(1)

  if (!result.length) return null

  const session = result[0]

  if (new Date(session.sessions.expiresAt) < new Date()) return null
  if (!session.users.isActive) return null

  return session.users
}

/**
 * Shared event handler for tus requests. Used by both index and catch-all routes.
 */
export async function handleTusRequest(event: any) {
  const server = getTusServer()

  const cookieHeader = getRequestHeader(event, 'cookie') || ''
  const user = await validateTusAuth(cookieHeader)

  if (!user) {
    setResponseStatus(event, 401)
    return { statusMessage: 'Unauthorized' }
  }

  if (!user.canWrite) {
    setResponseStatus(event, 403)
    return { statusMessage: 'Write access not permitted' }
  }

  const webReq = toWebRequest(event)
  const response = await server.handleWeb(webReq)
  return response
}
