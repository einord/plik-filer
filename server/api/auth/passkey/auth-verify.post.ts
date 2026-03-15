import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import { eq } from 'drizzle-orm'
import { passkeys, users } from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { challengeKey, authResponse } = body

  if (!challengeKey || !authResponse) {
    throw createError({ statusCode: 400, statusMessage: 'Missing challengeKey or authResponse' })
  }

  const config = useRuntimeConfig()
  const origin = config.origin as string
  const rpID = new URL(origin).hostname

  const expectedChallenge = getChallenge(challengeKey)
  if (!expectedChallenge) {
    throw createError({ statusCode: 400, statusMessage: 'Challenge expired or not found' })
  }

  // Look up the passkey by credential ID (base64url string from the browser)
  const db = useDb()

  const [passkey] = await db
    .select()
    .from(passkeys)
    .where(eq(passkeys.credentialId, authResponse.id))
    .limit(1)

  if (!passkey) {
    throw createError({ statusCode: 401, statusMessage: 'Passkey not found' })
  }

  // Look up the user
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, passkey.userId))
    .limit(1)

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'User not found' })
  }

  if (!user.isActive) {
    throw createError({ statusCode: 403, statusMessage: 'Account is deactivated' })
  }

  // Reconstruct the credential for verification
  const publicKeyBytes = Buffer.from(passkey.publicKey, 'base64url')

  let verification
  try {
    verification = await verifyAuthenticationResponse({
      response: authResponse,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.credentialId,
        publicKey: new Uint8Array(publicKeyBytes),
        counter: passkey.counter,
        transports: passkey.transports ? JSON.parse(passkey.transports) : undefined,
      },
    })
  } catch (err: any) {
    throw createError({ statusCode: 401, statusMessage: err.message || 'Authentication failed' })
  }

  if (!verification.verified) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication verification failed' })
  }

  // Update the counter
  await db
    .update(passkeys)
    .set({ counter: verification.authenticationInfo.newCounter })
    .where(eq(passkeys.id, passkey.id))

  // Create session
  await createSession(event, user.id)

  return {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      locale: user.locale,
      theme: user.theme,
    },
  }
})
