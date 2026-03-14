import { eq } from 'drizzle-orm'
import { settings } from '../../database/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const { serviceName, logoUrl, domainName } = body

  const db = useDb()
  const value = JSON.stringify({ serviceName, logoUrl, domainName })

  const [existing] = await db.select().from(settings).where(eq(settings.key, 'branding'))

  if (existing) {
    await db.update(settings).set({ value }).where(eq(settings.key, 'branding'))
  } else {
    await db.insert(settings).values({ key: 'branding', value })
  }

  return { success: true }
})
