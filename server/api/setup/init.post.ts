import { users } from '../../database/schema'

export default defineEventHandler(async (event) => {
  // Only allow if no admin exists yet
  const setupDone = await isSetupComplete()
  if (setupDone) {
    throw createError({ statusCode: 400, statusMessage: 'Setup already completed' })
  }

  const body = await readBody(event)
  const { email, name, password } = body

  if (!email || !name || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Email, name and password are required' })
  }

  const strength = checkPasswordStrength(password)
  if (strength.level === 'weak') {
    throw createError({ statusCode: 400, statusMessage: 'Password is too weak' })
  }

  const db = useDb()
  const passwordHash = await hashPassword(password)

  const [admin] = await db.insert(users).values({
    email,
    name,
    passwordHash,
    role: 'admin',
  }).returning()

  // Create session
  await createSession(event, admin.id)

  return {
    success: true,
    user: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    },
  }
})
