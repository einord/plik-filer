import { generateRegistrationOptions } from '@simplewebauthn/server'
import { eq } from 'drizzle-orm'
import { passkeys } from '#db'

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const config = useRuntimeConfig()
  const origin = config.origin as string
  const rpID = new URL(origin).hostname

  const db = useDb()

  // Fetch existing passkeys for excludeCredentials
  const existingPasskeys = await db
    .select()
    .from(passkeys)
    .where(eq(passkeys.userId, user.id))

  const excludeCredentials = existingPasskeys.map((pk) => ({
    id: pk.credentialId,
    transports: pk.transports ? JSON.parse(pk.transports) : undefined,
  }))

  const options = await generateRegistrationOptions({
    rpName: config.public.appName || 'plik Filer',
    rpID,
    userName: user.email || `user-${user.id}`,
    userDisplayName: user.name,
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  })

  // Remove empty hints array — causes Safari to hang
  if (Array.isArray((options as any).hints) && (options as any).hints.length === 0) {
    delete (options as any).hints
  }

  // Store challenge with a unique key to avoid overwrites from multiple requests
  const challengeKey = `reg:${user.id}:${Date.now()}`
  storeChallenge(challengeKey, options.challenge)

  return { ...options, challengeKey }
})
