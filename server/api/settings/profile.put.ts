import { eq } from 'drizzle-orm'
import { users } from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const body = await readBody(event)
  const { name, email, locale, theme } = body

  const db = useDb()
  const updates: Record<string, any> = { updatedAt: new Date().toISOString() }

  if (name) updates.name = name
  if (email) updates.email = email
  if (locale) updates.locale = locale
  if (theme) updates.theme = theme

  await db.update(users).set(updates).where(eq(users.id, session.user.id))

  return { success: true }
})
