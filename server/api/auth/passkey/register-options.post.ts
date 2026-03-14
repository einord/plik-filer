import { generateRegistrationOptions } from '@simplewebauthn/server'
import { eq } from 'drizzle-orm'
import { passkeys } from '../../../database/schema'

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
    userName: user.email,
    userDisplayName: user.name,
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  })

  // Store challenge keyed by a combination of user ID and a purpose tag
  const challengeKey = `reg:${user.id}`
  storeChallenge(challengeKey, options.challenge)

  return options
})
