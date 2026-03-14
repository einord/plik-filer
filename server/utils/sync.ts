import { readdirSync, renameSync, statSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { files, users } from '../database/schema'

export async function syncUserFiles(userId: number) {
  const db = useDb()
  const userDir = getUserDir(userId)

  let entries
  try {
    entries = readdirSync(userDir, { withFileTypes: true })
  } catch {
    console.error('[sync] Could not read directory for user', userId)
    return
  }

  // Filter out hidden files and directories
  const diskFiles = entries.filter(entry =>
    !entry.isDirectory() && !entry.name.startsWith('.')
  )

  // Get all existing storage names for this user
  const existingFiles = await db
    .select({ storageName: files.storageName })
    .from(files)
    .where(eq(files.userId, userId))

  const existingStorageNames = new Set(
    existingFiles
      .filter(f => f.storageName !== null)
      .map(f => f.storageName!)
  )

  for (const entry of diskFiles) {
    if (existingStorageNames.has(entry.name)) {
      continue
    }

    try {
      const originalName = entry.name
      const uuid = generateStorageName()
      const oldPath = join(userDir, originalName)
      const newPath = join(userDir, uuid)

      renameSync(oldPath, newPath)

      const stat = statSync(newPath)
      const mimeType = getMimeType(originalName)

      // Insert file record
      const [inserted] = await db.insert(files).values({
        userId,
        filename: originalName,
        storageName: uuid,
        path: originalName,
        size: stat.size,
        mimeType,
        isDirectory: false,
        parentId: null,
      }).returning()

      // Generate thumbnail for images and videos
      if (isImageFile(originalName) || isVideoFile(originalName)) {
        const thumbnailPath = await generateThumbnail(userId, newPath, originalName)
        if (thumbnailPath && inserted) {
          await db.update(files)
            .set({ thumbnailPath })
            .where(eq(files.id, inserted.id))
        }
      }

      console.log('[sync] Imported file:', originalName, '->', uuid)
    } catch (error) {
      console.error('[sync] Failed to import file:', entry.name, error)
    }
  }
}

export async function syncAllUsers() {
  console.log('[sync] Starting sync for all users...')
  const db = useDb()

  const allUsers = await db.select({ id: users.id }).from(users)

  for (const user of allUsers) {
    await syncUserFiles(user.id)
  }

  console.log('[sync] Sync complete for all users.')
}
