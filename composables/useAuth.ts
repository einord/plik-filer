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

  async function setupAccount(token: string, email: string, password: string) {
    const result = await $fetch('/api/auth/setup', {
      method: 'POST',
      body: { token, email, password },
    })
    if (result.success) {
      user.value = result.user as User
    }
    return result
  }

  async function loginWithPasskey(email?: string) {
    const { getCredential } = useWebAuthn()

    const options = await $fetch('/api/auth/passkey/auth-options', {
      method: 'POST',
      body: { email },
    })

    // Build clean PublicKeyCredentialRequestOptions
    const publicKey: PublicKeyCredentialRequestOptions = {
      challenge: _base64urlToBuffer(options.challenge),
      rpId: options.rpId,
      timeout: options.timeout || 60000,
      userVerification: options.userVerification || 'preferred',
    }
    if (options.allowCredentials) {
      (publicKey as any).allowCredentials = options.allowCredentials.map((c: any) => ({
        id: _base64urlToBuffer(c.id),
        type: 'public-key' as const,
        transports: c.transports,
      }))
    }

    const credential = await getCredential(publicKey)
    if (!credential) throw new Error('No credential returned')

    const response = credential.response as AuthenticatorAssertionResponse

    const authResponse = {
      id: credential.id,
      rawId: _bufferToBase64url(credential.rawId),
      type: credential.type,
      response: {
        authenticatorData: _bufferToBase64url(response.authenticatorData),
        clientDataJSON: _bufferToBase64url(response.clientDataJSON),
        signature: _bufferToBase64url(response.signature),
        userHandle: response.userHandle ? _bufferToBase64url(response.userHandle) : undefined,
      },
      clientExtensionResults: credential.getClientExtensionResults(),
    }

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

  function _base64urlToBuffer(base64url: string): ArrayBuffer {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes.buffer
  }

  function _bufferToBase64url(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
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
    setupAccount,
    loginWithPasskey,
  }
}
