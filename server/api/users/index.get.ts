import { users } from '../../database/schema'

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
  }).from(users)

  return { users: allUsers }
})
