import { invitations } from '#db'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const db = useDb()
  const allInvitations = await db.select().from(invitations).orderBy(invitations.createdAt)

  return {
    invitations: allInvitations.map((inv) => ({
      ...inv,
      status: inv.usedAt ? 'used' : new Date(inv.expiresAt) < new Date() ? 'expired' : 'pending',
    })),
  }
})
