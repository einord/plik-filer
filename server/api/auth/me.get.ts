export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session) {
    return { user: null }
  }

  const { user } = session
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      canRead: user.canRead,
      canWrite: user.canWrite,
      locale: user.locale,
      theme: user.theme,
      maxFileSize: user.maxFileSize,
    },
  }
})
