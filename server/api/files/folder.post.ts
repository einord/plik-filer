import { mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { eq } from 'drizzle-orm'
import { files } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)

  if (!session.user.canWrite) {
    throw createError({ statusCode: 403, statusMessage: 'Write access not permitted' })
  }

  const body = await readBody(event)
  const { name, parentId } = body

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Folder name is required' })
  }

  const folderName = sanitizeFilename(name)
  const db = useDb()
  const userDir = getUserDir(session.user.id)

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
    userId: session.user.id,
    filename: folderName,
    path: relativePath,
    size: 0,
    isDirectory: true,
    parentId: parentId || null,
  }).returning()

  return { success: true, folder }
})
