import { eq } from 'drizzle-orm'
import { users } from '../../database/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readBody(event)
  const { name, email } = body

  if (!name || !name.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Name is required' })
  }

  const db = useDb()

  // Check if email already exists (if provided)
  if (email) {
    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1)
    if (existing) {
      throw createError({ statusCode: 400, statusMessage: 'Email already registered' })
    }
  }

  // Create user
  const [user] = await db.insert(users).values({
    email: email || null,
    name: name.trim(),
    role: 'user',
  }).returning()

  // Create user directory
  getUserDir(user.id)

  return {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    },
  }
})
