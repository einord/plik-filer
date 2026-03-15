import { eq } from 'drizzle-orm'
import { users } from '#db'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Invalid user ID' })

  const body = await readBody(event)
  const allowedFields = ['name', 'email', 'isActive', 'canRead', 'canWrite', 'maxFileSize', 'role'] as const

  const updates: Record<string, any> = { updatedAt: new Date().toISOString() }
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      // Map camelCase to snake_case for boolean fields
      updates[field] = body[field]
    }
  }

  const db = useDb()

  // Validate email uniqueness if email is being changed
  if (updates.email !== undefined && updates.email !== null) {
    const [existing] = await db.select().from(users)
      .where(eq(users.email, updates.email))
      .limit(1)
    if (existing && existing.id !== id) {
      throw createError({ statusCode: 400, statusMessage: 'Email already registered' })
    }
  }

  await db.update(users).set(updates).where(eq(users.id, id))

  const [updated] = await db.select().from(users).where(eq(users.id, id)).limit(1)

  return {
    success: true,
    user: {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      isActive: updated.isActive,
      canRead: updated.canRead,
      canWrite: updated.canWrite,
      maxFileSize: updated.maxFileSize,
    },
  }
})
