import { eq } from 'drizzle-orm'
import { users, passwordResets, settings } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email } = body

  if (!email) {
    throw createError({ statusCode: 400, statusMessage: 'Email is required' })
  }

  const db = useDb()
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)

  // Always return success to prevent email enumeration
  if (!user) {
    return { success: true }
  }

  const token = generateToken(48)
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour

  await db.insert(passwordResets).values({
    userId: user.id,
    token,
    expiresAt,
  })

  // Get service name from settings
  const [brandingSetting] = await db.select().from(settings).where(eq(settings.key, 'branding'))
  let serviceName = 'plik Filer'
  if (brandingSetting) {
    try {
      const branding = JSON.parse(brandingSetting.value)
      if (branding.serviceName) serviceName = branding.serviceName
    } catch {}
  }

  const config = useRuntimeConfig()
  const origin = config.origin || 'http://localhost:3000'
  const resetUrl = `${origin}/auth/reset-password?token=${token}`

  await sendPasswordResetMail(email, resetUrl, serviceName)

  return { success: true }
})
