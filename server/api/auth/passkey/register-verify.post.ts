import { verifyRegistrationResponse } from '@simplewebauthn/server'
import { passkeys } from '~~/server/database/schema'

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const body = await readBody(event)
  const config = useRuntimeConfig()
  const origin = config.origin as string
  const rpID = new URL(origin).hostname

  const challengeKey = body.challengeKey || `reg:${user.id}`
  const expectedChallenge = getChallenge(challengeKey)

  if (!expectedChallenge) {
    throw createError({ statusCode: 400, statusMessage: 'Challenge expired or not found' })
  }

  let verification
  try {
    verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    })
  } catch (err: any) {
    throw createError({ statusCode: 400, statusMessage: err.message || 'Verification failed' })
  }

  if (!verification.verified || !verification.registrationInfo) {
    throw createError({ statusCode: 400, statusMessage: 'Registration verification failed' })
  }

  const { credential } = verification.registrationInfo

  const db = useDb()

  // In simplewebauthn v13, credential.id is already a base64url string
  // and credential.publicKey is a Uint8Array
  const credentialId = credential.id
  const publicKeyBase64url = typeof credential.publicKey === 'string'
    ? credential.publicKey
    : Buffer.from(credential.publicKey).toString('base64url')

  await db.insert(passkeys).values({
    userId: user.id,
    credentialId,
    publicKey: publicKeyBase64url,
    counter: credential.counter,
    transports: body.response?.transports ? JSON.stringify(body.response.transports) : null,
  })

  return { success: true }
})
