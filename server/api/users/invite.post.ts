import { eq } from 'drizzle-orm'
import { invitations, settings } from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event)
  const body = await readBody(event)
  const { email } = body

  const db = useDb()
  const token = generateToken(32)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days

  await db.insert(invitations).values({
    token,
    createdBy: session.user.id,
    email: email || null,
    expiresAt,
  })

  const config = useRuntimeConfig()
  const origin = config.origin || 'http://localhost:3000'
  const inviteUrl = `${origin}/auth/register?token=${token}`

  // Send invitation email if email provided
  if (email) {
    const [brandingSetting] = await db.select().from(settings).where(eq(settings.key, 'branding'))
    let serviceName = 'plik Filer'
    if (brandingSetting) {
      try {
        const branding = JSON.parse(brandingSetting.value)
        if (branding.serviceName) serviceName = branding.serviceName
      } catch {}
    }
    await sendInvitationMail(email, inviteUrl, serviceName)
  }

  return {
    success: true,
    invitation: {
      token,
      url: inviteUrl,
      expiresAt,
    },
  }
})
