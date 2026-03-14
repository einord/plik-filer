export default defineNuxtRouteMiddleware(async (to) => {
  // Skip middleware on server-side to avoid SSR issues
  if (import.meta.server) return

  const { fetchUser, isAuthenticated, initialized } = useAuth()

  // Always fetch user on first load
  if (!initialized.value) {
    await fetchUser()
  }

  // Public routes that don't require auth
  const publicRoutes = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password', '/setup']
  const isPublicRoute = publicRoutes.some((route) => to.path.startsWith(route))
  const isShareRoute = to.path.startsWith('/share/')

  if (isShareRoute) return

  // Check if setup is needed
  if (to.path !== '/setup') {
    try {
      const { setupComplete } = await $fetch('/api/setup/status')
      if (!setupComplete) {
        return navigateTo('/setup')
      }
    } catch {}
  }

  if (!isAuthenticated.value && !isPublicRoute) {
    return navigateTo('/auth/login')
  }

  if (isAuthenticated.value && isPublicRoute) {
    return navigateTo('/files')
  }

  // Admin routes
  if (to.path.startsWith('/admin')) {
    const { isAdmin } = useAuth()
    if (!isAdmin.value) {
      return navigateTo('/files')
    }
  }
})
