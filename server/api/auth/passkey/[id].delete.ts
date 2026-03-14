import { eq, and } from 'drizzle-orm'
import { passkeys, users } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))

  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid passkey ID' })
  }

  const db = useDb()

  // Check if user has a password set
  const [currentUser] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1)

  const hasPassword = !!currentUser?.passwordHash

  // Count user's passkeys
  const userPasskeys = await db
    .select({ id: passkeys.id })
    .from(passkeys)
    .where(eq(passkeys.userId, user.id))

  // Don't allow deleting the last passkey if user has no password
  if (userPasskeys.length <= 1 && !hasPassword) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Cannot delete last passkey when no password is set',
    })
  }

  // Delete the passkey (only if it belongs to the current user)
  const result = await db
    .delete(passkeys)
    .where(and(eq(passkeys.id, id), eq(passkeys.userId, user.id)))

  return { success: true }
})
