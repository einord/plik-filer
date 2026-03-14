import type { User } from '~/types'

export function useAuth() {
  const user = useState<User | null>('auth-user', () => null)
  const loading = useState<boolean>('auth-loading', () => true)
  const initialized = useState<boolean>('auth-initialized', () => false)

  async function fetchUser() {
    try {
      const data = await $fetch('/api/auth/me')
      if (data?.user) {
        user.value = data.user as User
      } else {
        user.value = null
      }
    } catch {
      user.value = null
    } finally {
      loading.value = false
      initialized.value = true
    }
  }

  async function login(email: string, password: string) {
    const result = await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    if (result.success) {
      user.value = result.user as User
    }
    return result
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
    await navigateTo('/auth/login')
  }

  async function register(token: string, email: string, name: string, password: string) {
    const result = await $fetch('/api/auth/register', {
      method: 'POST',
      body: { token, email, name, password },
    })
    if (result.success) {
      user.value = result.user as User
    }
    return result
  }

  async function loginWithPasskey(email?: string) {
    const options = await $fetch('/api/auth/passkey/auth-options', {
      method: 'POST',
      body: { email },
    })

    const { startAuthentication } = await import('@simplewebauthn/browser')
    const authResponse = await startAuthentication({ optionsJSON: options })

    const result = await $fetch('/api/auth/passkey/auth-verify', {
      method: 'POST',
      body: {
        challengeKey: (options as any).challengeKey,
        authResponse,
      },
    })

    if (result.success) {
      user.value = result.user as User
    }
    return result
  }

  const isAuthenticated = computed(() => !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin')

  return {
    user,
    loading,
    initialized,
    isAuthenticated,
    isAdmin,
    fetchUser,
    login,
    logout,
    register,
    loginWithPasskey,
  }
}
