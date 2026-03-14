<script setup lang="ts">
import { HugeiconsIcon } from '@hugeicons/vue'
import { ViewIcon, ViewOffIcon, Key01Icon } from '@hugeicons/core-free-icons'

definePageMeta({ layout: 'auth' })

const { t } = useI18n()
const route = useRoute()
const { setupAccount } = useAuth()
const { checkStrength, generatePassword } = usePasswordStrength()
const { createCredential } = useWebAuthn()

const token = route.query.token as string

const form = reactive({ email: '', password: '', confirmPassword: '' })
const userName = ref('')
const error = ref('')
const loading = ref(false)
const passkeyLoading = ref(false)
const pageLoading = ref(true)
const showPassword = ref(false)

const passwordStrength = computed(() => {
  if (!form.password) return null
  return checkStrength(form.password)
})

const strengthColor = computed(() => {
  const colors = { weak: 'var(--color-error)', fair: 'var(--color-warning)', good: 'var(--color-info)', strong: 'var(--color-success)' }
  return passwordStrength.value ? colors[passwordStrength.value.level] : ''
})

function handleGenerate() {
  const pw = generatePassword()
  form.password = pw
  form.confirmPassword = pw
  showPassword.value = true
}

async function handleSubmit() {
  if (!form.email || !form.password) return

  if (form.password !== form.confirmPassword) {
    error.value = t('auth.passwordsDoNotMatch')
    return
  }

  if (passwordStrength.value?.level === 'weak') {
    error.value = t('auth.passwordTooWeak')
    return
  }

  loading.value = true
  error.value = ''

  try {
    await setupAccount(token, form.email, form.password)
    await navigateTo('/files')
  } catch (e: any) {
    error.value = e.data?.statusMessage || t('errors.serverError')
  } finally {
    loading.value = false
  }
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

let passkeyInProgress = false

async function handlePasskeySetup() {
  if (passkeyInProgress) return
  if (!form.email) {
    error.value = t('accountSetup.emailRequired')
    return
  }

  passkeyInProgress = true
  passkeyLoading.value = true
  error.value = ''

  try {
    // Step 1: Complete setup with email only (no password) — this logs us in
    await setupAccount(token, form.email)

    // Step 2: Get passkey registration options (now authenticated)
    const options = await $fetch('/api/auth/passkey/register-options', { method: 'POST' })

    // Step 3: Build PublicKeyCredentialCreationOptions
    const publicKey: PublicKeyCredentialCreationOptions = {
      challenge: _base64urlToBuffer(options.challenge),
      rp: { name: options.rp.name, id: options.rp.id },
      user: {
        id: _base64urlToBuffer(options.user.id),
        name: options.user.name,
        displayName: options.user.displayName,
      },
      pubKeyCredParams: options.pubKeyCredParams,
      timeout: options.timeout || 60000,
      attestation: options.attestation || 'none',
      authenticatorSelection: options.authenticatorSelection,
    }
    if (options.excludeCredentials) {
      publicKey.excludeCredentials = options.excludeCredentials.map((c: any) => ({
        id: _base64urlToBuffer(c.id),
        type: 'public-key' as const,
        transports: c.transports,
      }))
    }

    // Step 4: Create credential via browser
    const credential = await createCredential(publicKey)
    if (!credential) {
      // User cancelled, but account is already set up with email — redirect
      await navigateTo('/files')
      return
    }

    // Step 5: Verify and store passkey
    const response = credential.response as AuthenticatorAttestationResponse
    const registrationResponse = {
      id: credential.id,
      rawId: _bufferToBase64url(credential.rawId),
      type: credential.type,
      response: {
        attestationObject: _bufferToBase64url(response.attestationObject),
        clientDataJSON: _bufferToBase64url(response.clientDataJSON),
        transports: response.getTransports?.() || [],
      },
      clientExtensionResults: credential.getClientExtensionResults(),
    }

    await $fetch('/api/auth/passkey/register-verify', {
      method: 'POST',
      body: { ...registrationResponse, challengeKey: (options as any).challengeKey },
    })

    await navigateTo('/files')
  } catch (e: any) {
    if (e.name === 'NotAllowedError' || e.name === 'AbortError') {
      // User cancelled passkey — account is set up, just redirect
      await navigateTo('/files')
    } else {
      error.value = e.data?.statusMessage || e.message || t('errors.serverError')
    }
  } finally {
    passkeyLoading.value = false
    passkeyInProgress = false
  }
}

// Load setup info
onMounted(async () => {
  if (!token) {
    await navigateTo('/auth/login')
    return
  }

  try {
    const data = await $fetch('/api/auth/setup', {
      params: { token },
    })
    userName.value = data.name
    if (data.email) {
      form.email = data.email
    }
  } catch (e: any) {
    error.value = e.data?.statusMessage || t('accountSetup.invalidToken')
  } finally {
    pageLoading.value = false
  }
})
</script>

<template>
  <div>
    <div v-if="pageLoading" style="text-align: center; padding: var(--space-8);">
      {{ $t('common.loading') }}
    </div>

    <template v-else-if="userName">
      <h1 style="font-size: var(--text-2xl); font-weight: 700; margin-bottom: var(--space-2);">
        {{ $t('accountSetup.title') }}
      </h1>
      <p style="color: var(--text-secondary); margin-bottom: var(--space-6);">
        {{ $t('accountSetup.welcomeMessage', { name: userName }) }}
      </p>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <!-- Email field (shared between both methods) -->
      <div class="form-group">
        <label for="email">{{ $t('auth.email') }}</label>
        <input id="email" v-model="form.email" type="email" required autocomplete="email" />
      </div>

      <!-- Passkey option -->
      <PBtn
        size="lg"
        block
        :icon="Key01Icon"
        :disabled="passkeyLoading || loading"
        @click="handlePasskeySetup"
      >
        {{ passkeyLoading ? $t('common.loading') : $t('auth.usePasskey') }}
      </PBtn>
      <p class="passkey-hint">{{ $t('auth.passkeyDescription') }}</p>

      <div class="divider">
        <span>{{ $t('auth.usePassword') }}</span>
      </div>

      <!-- Password form -->
      <form @submit.prevent="handleSubmit">
        <div class="form-group">
          <label for="password">{{ $t('auth.password') }}</label>
          <div class="password-input">
            <input
              id="password"
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              required
              autocomplete="new-password"
            />
            <PBtn type="button" variant="ghost" size="sm" :icon="showPassword ? ViewOffIcon : ViewIcon" icon-only @click="showPassword = !showPassword" />
          </div>
          <div style="margin-top: var(--space-1);">
            <PBtn type="button" variant="ghost" size="sm" @click="handleGenerate">
              {{ $t('auth.generatePassword') }}
            </PBtn>
          </div>

          <div v-if="passwordStrength" class="password-strength">
            <div class="strength-bar">
              <div
                class="strength-bar-fill"
                :style="{ width: `${(passwordStrength.score / 6) * 100}%`, backgroundColor: strengthColor }"
              />
            </div>
            <span class="strength-label" :style="{ color: strengthColor }">
              {{ $t(`auth.passwordStrength.${passwordStrength.level}`) }}
            </span>
          </div>
        </div>

        <div class="form-group">
          <label for="confirmPassword">{{ $t('auth.confirmPassword') }}</label>
          <input id="confirmPassword" v-model="form.confirmPassword" type="password" required autocomplete="new-password" />
        </div>

        <div style="margin-top: var(--space-4);">
          <PBtn type="submit" size="lg" block :disabled="loading || passkeyLoading">
            {{ loading ? $t('common.loading') : $t('accountSetup.completeSetup') }}
          </PBtn>
        </div>
      </form>
    </template>

    <template v-else>
      <div class="error-message">
        {{ error || $t('accountSetup.invalidToken') }}
      </div>
    </template>
  </div>
</template>

<style scoped>
.form-group {
  margin-bottom: var(--space-4);
}

.password-input {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.password-input input {
  flex: 1;
}

.password-strength {
  margin-top: var(--space-2);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.strength-bar {
  flex: 1;
  height: 4px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.strength-bar-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width var(--transition-base), background-color var(--transition-base);
}

.strength-label {
  font-size: var(--text-xs);
  font-weight: 500;
}

.error-message {
  background-color: rgba(239, 68, 68, 0.1);
  color: var(--color-error);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  margin-bottom: var(--space-4);
}

.passkey-hint {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  text-align: center;
  margin-top: var(--space-2);
  margin-bottom: var(--space-4);
}

.divider {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: var(--space-4) 0;
  color: var(--text-secondary);
  font-size: var(--text-sm);
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border-primary);
}
</style>
