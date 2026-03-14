import { mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { eq } from 'drizzle-orm'
import { files, users } from '../../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const userId = Number(getRouterParam(event, 'userId'))
  if (!userId) throw createError({ statusCode: 400, statusMessage: 'Invalid user ID' })

  const db = useDb()

  // Validate that the target user exists
  const [targetUser] = await db.select().from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!targetUser) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  const body = await readBody(event)
  const { name, parentId } = body

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Folder name is required' })
  }

  const folderName = sanitizeFilename(name)
  const userDir = getUserDir(userId)

  let targetDir = userDir
  let relativePath = folderName

  if (parentId) {
    const [parentFolder] = await db.select().from(files)
      .where(eq(files.id, parentId))
      .limit(1)
    if (parentFolder && parentFolder.isDirectory) {
      targetDir = join(userDir, parentFolder.path)
      relativePath = join(parentFolder.path, folderName)
    }
  }

  const fullPath = join(targetDir, folderName)
  if (existsSync(fullPath)) {
    throw createError({ statusCode: 409, statusMessage: 'Folder already exists' })
  }

  mkdirSync(fullPath, { recursive: true })

  const [folder] = await db.insert(files).values({
    userId,
    filename: folderName,
    path: relativePath,
    size: 0,
    isDirectory: true,
    parentId: parentId || null,
  }).returning()

  return { success: true, folder }
})
