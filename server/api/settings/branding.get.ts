import { eq } from 'drizzle-orm'
import { settings } from '../../database/schema'

export default defineEventHandler(async () => {
  const db = useDb()
  const [result] = await db.select().from(settings).where(eq(settings.key, 'branding'))

  if (!result) {
    return { branding: { serviceName: 'plik Filer', logoUrl: '', domainName: '', logoType: 'none' } }
  }

  return { branding: JSON.parse(result.value) }
})
