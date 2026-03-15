import { eq } from 'drizzle-orm'
import { users, invitations } from '#db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { token, email, name, password } = body

  if (!token || !email || !name || !password) {
    throw createError({ statusCode: 400, statusMessage: 'All fields are required' })
  }

  const db = useDb()

  // Validate invitation token
  const [invitation] = await db.select().from(invitations).where(eq(invitations.token, token)).limit(1)

  if (!invitation) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid invitation' })
  }

  if (invitation.usedAt) {
    throw createError({ statusCode: 400, statusMessage: 'Invitation already used' })
  }

  if (new Date(invitation.expiresAt) < new Date()) {
    throw createError({ statusCode: 400, statusMessage: 'Invitation has expired' })
  }

  // Validate password strength
  const strength = checkPasswordStrength(password)
  if (strength.level === 'weak') {
    throw createError({ statusCode: 400, statusMessage: 'Password is too weak' })
  }

  // Check if email already exists
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (existing) {
    throw createError({ statusCode: 400, statusMessage: 'Email already registered' })
  }

  const passwordHash = await hashPassword(password)

  // Create user
  const [user] = await db.insert(users).values({
    email,
    name,
    passwordHash,
    role: 'user',
  }).returning()

  // Mark invitation as used
  await db.update(invitations).set({
    usedAt: new Date().toISOString(),
    usedBy: user.id,
  }).where(eq(invitations.id, invitation.id))

  // Create user directory
  getUserDir(user.id)

  // Create session
  await createSession(event, user.id)

  return {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  }
})
