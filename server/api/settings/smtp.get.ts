import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const db = useDb()
  const [result] = await db.select().from(settings).where(eq(settings.key, 'smtp'))

  if (!result) {
    return { smtp: null }
  }

  const smtp = JSON.parse(result.value)
  // Don't expose the actual password
  return {
    smtp: {
      ...smtp,
      password: smtp.password ? '••••••••' : '',
    },
  }
})
