import { eq } from 'drizzle-orm'
import { settings } from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const { host, port, username, password, fromEmail, fromName, secure } = body

  const db = useDb()

  // If password is masked, keep the existing one
  let actualPassword = password
  if (password === '••••••••') {
    const [existing] = await db.select().from(settings).where(eq(settings.key, 'smtp'))
    if (existing) {
      const existingSmtp = JSON.parse(existing.value)
      actualPassword = existingSmtp.password
    }
  }

  const value = JSON.stringify({
    host, port: Number(port), username,
    password: actualPassword, fromEmail, fromName,
    secure: Boolean(secure),
  })

  const [existing] = await db.select().from(settings).where(eq(settings.key, 'smtp'))

  if (existing) {
    await db.update(settings).set({ value }).where(eq(settings.key, 'smtp'))
  } else {
    await db.insert(settings).values({ key: 'smtp', value })
  }

  return { success: true }
})
