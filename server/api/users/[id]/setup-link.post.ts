import { eq } from 'drizzle-orm'
import { users, settings } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid user ID' })
  }

  const db = useDb()

  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  if (user.email && user.passwordHash) {
    throw createError({ statusCode: 400, statusMessage: 'User has already completed setup' })
  }

  const setupToken = generateToken(32)
  const setupTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  await db.update(users).set({
    setupToken,
    setupTokenExpiresAt,
  }).where(eq(users.id, id))

  const brandingResult = await db.select().from(settings).where(eq(settings.key, 'branding'))
  const branding = brandingResult.length ? JSON.parse(brandingResult[0].value) : {}
  const config = useRuntimeConfig()
  const origin = branding.domainName
    ? `https://${branding.domainName}`
    : config.origin || 'http://localhost:3000'
  const setupUrl = `${origin}/auth/setup?token=${setupToken}`

  let emailSent = false
  if (user.email) {
    const serviceName = branding.serviceName || 'plik Filer'
    emailSent = await sendSetupMail(user.email, setupUrl, serviceName)
  }

  return {
    success: true,
    setupUrl,
    emailSent,
  }
})
