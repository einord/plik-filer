import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'

export default defineEventHandler(async (event) => {
  const body = await readBody(event) || {}
  const { email } = body
  const config = useRuntimeConfig()
  const origin = config.origin as string
  const rpID = new URL(origin).hostname

  const db = useDb()

  let allowCredentials: { id: string; transports?: string[] }[] | undefined

  if (email) {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)

    if (user) {
      const userPasskeys = await db
        .select()
        .from(passkeys)
        .where(eq(passkeys.userId, user.id))

      if (userPasskeys.length > 0) {
        allowCredentials = userPasskeys.map((pk) => ({
          id: pk.credentialId,
          transports: pk.transports ? JSON.parse(pk.transports) : undefined,
        }))
      }
    }
  }

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'preferred',
    allowCredentials,
  })

  // Remove empty hints array — causes Safari to hang
  if (Array.isArray((options as any).hints) && (options as any).hints.length === 0) {
    delete (options as any).hints
  }

  // Use a random key for unauthenticated challenge storage
  const challengeKey = `auth:${nanoid(32)}`
  storeChallenge(challengeKey, options.challenge)

  return {
    ...options,
    challengeKey,
  }
})
