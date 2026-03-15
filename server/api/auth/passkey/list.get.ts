import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const db = useDb()

  const userPasskeys = await db
    .select({
      id: passkeys.id,
      credentialId: passkeys.credentialId,
      createdAt: passkeys.createdAt,
    })
    .from(passkeys)
    .where(eq(passkeys.userId, user.id))

  // Return partial credential IDs for display
  return userPasskeys.map((pk) => ({
    id: pk.id,
    credentialIdPreview: pk.credentialId.substring(0, 8) + '...',
    createdAt: pk.createdAt,
  }))
})
