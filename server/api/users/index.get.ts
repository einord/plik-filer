import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const db = useDb()
  const allUsers = await db.select({
    id: users.id,
    email: users.email,
    name: users.name,
    role: users.role,
    isActive: users.isActive,
    canRead: users.canRead,
    canWrite: users.canWrite,
    maxFileSize: users.maxFileSize,
    createdAt: users.createdAt,
    passwordHash: users.passwordHash,
    setupToken: users.setupToken,
  }).from(users)

  // Check which users have passkeys
  const allPasskeys = await db.select({ userId: passkeys.userId }).from(passkeys)
  const usersWithPasskeys = new Set(allPasskeys.map(p => p.userId))

  return {
    users: allUsers.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      isActive: u.isActive,
      canRead: u.canRead,
      canWrite: u.canWrite,
      maxFileSize: u.maxFileSize,
      createdAt: u.createdAt,
      setupCompleted: !!u.passwordHash || usersWithPasskeys.has(u.id),
      hasSetupToken: !!u.setupToken,
    })),
  }
})
