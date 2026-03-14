<script setup lang="ts">
import { HugeiconsIcon } from '@hugeicons/vue'
import { ViewIcon, ViewOffIcon, Delete02Icon } from '@hugeicons/core-free-icons'

const { t, locale, setLocale } = useI18n()
const { user, fetchUser } = useAuth()
const colorMode = useColorMode()
const { checkStrength, generatePassword } = usePasswordStrength()

const success = ref('')
const error = ref('')

// Passkeys
interface PasskeyListItem {
  id: number
  credentialIdPreview: string
  createdAt: string
}
const passkeyList = ref<PasskeyListItem[]>([])
const passkeyLoading = ref(false)
const passkeyDeleteConfirm = ref<number | null>(null)

async function loadPasskeys() {
  try {
    passkeyList.value = await $fetch('/api/auth/passkey/list')
  } catch {
    // Silently fail on load
  }
}


const { createCredential, abort: abortWebAuthn } = useWebAuthn()

let passkeyInProgress = false

async function addPasskey() {
  if (passkeyInProgress) return
  passkeyInProgress = true
  passkeyLoading.value = true
  error.value = ''
  success.value = ''

  let options: any
  try {
    options = await $fetch('/api/auth/passkey/register-options', { method: 'POST' })
  } catch {
    error.value = t('errors.serverError')
    passkeyLoading.value = false
    return
  }

  // Build clean PublicKeyCredentialCreationOptions
  const publicKey: PublicKeyCredentialCreationOptions = {
    rp: options.rp,
    user: {
      id: base64urlToBuffer(options.user.id),
      name: options.user.name,
      displayName: options.user.displayName,
    },
    challenge: base64urlToBuffer(options.challenge),
    pubKeyCredParams: options.pubKeyCredParams,
    timeout: options.timeout || 60000,
    attestation: (options.attestation || 'none') as AttestationConveyancePreference,
    authenticatorSelection: options.authenticatorSelection,
    excludeCredentials: (options.excludeCredentials || []).map((c: any) => ({
      id: base64urlToBuffer(c.id),
      type: 'public-key' as const,
      transports: c.transports,
    })),
  }

  let credential: PublicKeyCredential | null
  try {
    credential = await createCredential(publicKey)
  } catch (e: any) {
    passkeyLoading.value = false
    passkeyInProgress = false
    if (e.name === 'NotAllowedError' || e.name === 'AbortError') return
    error.value = e.message || t('errors.serverError')
    return
  }

  if (!credential) {
    passkeyLoading.value = false
    passkeyInProgress = false
    return
  }

  try {
    const response = credential.response as AuthenticatorAttestationResponse
    const registrationResponse = {
      id: credential.id,
      rawId: bufferToBase64url(credential.rawId),
      type: credential.type,
      response: {
        attestationObject: bufferToBase64url(response.attestationObject),
        clientDataJSON: bufferToBase64url(response.clientDataJSON),
        transports: response.getTransports?.() || [],
      },
      clientExtensionResults: credential.getClientExtensionResults(),
    }

    await $fetch('/api/auth/passkey/register-verify', {
      method: 'POST',
      body: { ...registrationResponse, challengeKey: options.challengeKey },
    })

    success.value = t('settings.passkeyAdded')
    await loadPasskeys()
  } catch (e: any) {
    error.value = e.data?.statusMessage || e.message || t('errors.serverError')
  }

  passkeyLoading.value = false
  passkeyInProgress = false
}

function cancelPasskeyRegistration() {
  abortWebAuthn()
  passkeyLoading.value = false
  passkeyInProgress = false
}

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function removePasskey(id: number) {
  error.value = ''
  success.value = ''

  try {
    await $fetch(`/api/auth/passkey/${id}`, { method: 'DELETE' })
    success.value = t('settings.passkeyRemoved')
    passkeyDeleteConfirm.value = null
    await loadPasskeys()
  } catch (e: any) {
    error.value = e.data?.statusMessage || t('errors.serverError')
  }
}

// Load passkeys on mount
onMounted(() => {
  loadPasskeys()
})

// Profile
const profile = reactive({
  name: user.value?.name || '',
  email: user.value?.email || '',
})

// Password
const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})
const showPassword = ref(false)

const passwordStrength = computed(() => {
  if (!passwordForm.newPassword) return null
  return checkStrength(passwordForm.newPassword)
})

async function saveProfile() {
  error.value = ''
  success.value = ''
  try {
    await $fetch('/api/settings/profile', {
      method: 'PUT',
      body: {
        name: profile.name,
        email: profile.email,
        locale: locale.value,
        theme: colorMode.preference,
      },
    })
    success.value = t('settings.profileUpdated')
    await fetchUser()
  } catch (e: any) {
    error.value = e.data?.statusMessage || t('errors.serverError')
  }
}

async function changePassword() {
  error.value = ''
  success.value = ''

  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    error.value = t('auth.passwordsDoNotMatch')
    return
  }

  if (passwordStrength.value?.level === 'weak') {
    error.value = t('auth.passwordTooWeak')
    return
  }

  try {
    await $fetch('/api/settings/password', {
      method: 'PUT',
      body: {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      },
    })
    success.value = t('settings.passwordChanged')
    passwordForm.currentPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
  } catch (e: any) {
    error.value = e.data?.statusMessage || t('errors.serverError')
  }
}

function handleGenerate() {
  const pw = generatePassword()
  passwordForm.newPassword = pw
  passwordForm.confirmPassword = pw
  showPassword.value = true
}

function handleLocaleChange(newLocale: string) {
  setLocale(newLocale)
}
</script>

<template>
  <div class="container-sm">
    <h1 style="font-size: var(--text-xl); font-weight: 700; margin-bottom: var(--space-6);">
      {{ $t('settings.settings') }}
    </h1>

    <div v-if="success" class="success-message">{{ success }}</div>
    <div v-if="error" class="error-message">{{ error }}</div>

    <!-- Profile -->
    <div class="card section">
      <h2 class="section-title">{{ $t('settings.profile') }}</h2>
      <form @submit.prevent="saveProfile">
        <div class="form-group">
          <label>{{ $t('auth.name') }}</label>
          <input v-model="profile.name" type="text" />
        </div>
        <div class="form-group">
          <label>{{ $t('auth.email') }}</label>
          <input v-model="profile.email" type="email" />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>{{ $t('settings.language') }}</label>
            <select :value="locale" @change="handleLocaleChange(($event.target as HTMLSelectElement).value)">
              <option value="sv">Svenska</option>
              <option value="en">English</option>
            </select>
          </div>
          <div class="form-group">
            <label>{{ $t('settings.theme') }}</label>
            <select v-model="colorMode.preference">
              <option value="system">{{ $t('settings.themeAuto') }}</option>
              <option value="light">{{ $t('settings.themeLight') }}</option>
              <option value="dark">{{ $t('settings.themeDark') }}</option>
            </select>
          </div>
        </div>

        <PBtn type="submit">{{ $t('common.save') }}</PBtn>
      </form>
    </div>

    <!-- Password -->
    <div class="card section">
      <h2 class="section-title">{{ $t('settings.changePassword') }}</h2>
      <form @submit.prevent="changePassword">
        <div class="form-group">
          <label>{{ $t('settings.currentPassword') }}</label>
          <input v-model="passwordForm.currentPassword" type="password" autocomplete="current-password" />
        </div>
        <div class="form-group">
          <label>{{ $t('settings.newPassword') }}</label>
          <div class="password-input">
            <input
              v-model="passwordForm.newPassword"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="new-password"
            />
            <PBtn type="button" variant="ghost" size="sm" :icon="showPassword ? ViewOffIcon : ViewIcon" icon-only @click="showPassword = !showPassword" :title="showPassword ? $t('common.hide') : $t('common.show')" />
          </div>
          <div style="margin-top: var(--space-1);">
            <PBtn type="button" variant="ghost" size="sm" @click="handleGenerate">
              {{ $t('auth.generatePassword') }}
            </PBtn>
          </div>
          <div v-if="passwordStrength" class="password-strength">
            <div class="strength-bar">
              <div class="strength-bar-fill" :style="{ width: `${(passwordStrength.score / 6) * 100}%` }" />
            </div>
            <span>{{ $t(`auth.passwordStrength.${passwordStrength.level}`) }}</span>
          </div>
        </div>
        <div class="form-group">
          <label>{{ $t('auth.confirmPassword') }}</label>
          <input v-model="passwordForm.confirmPassword" type="password" autocomplete="new-password" />
        </div>
        <PBtn type="submit">{{ $t('settings.changePassword') }}</PBtn>
      </form>
    </div>

    <!-- Passkeys -->
    <div class="card section">
      <h2 class="section-title">{{ $t('settings.passkeys') }}</h2>

      <div v-if="passkeyList.length > 0" class="passkey-list">
        <div v-for="pk in passkeyList" :key="pk.id" class="passkey-item">
          <div class="passkey-info">
            <span class="passkey-id">{{ pk.credentialIdPreview }}</span>
            <span class="passkey-date">{{ new Date(pk.createdAt).toLocaleDateString() }}</span>
          </div>
          <div class="passkey-actions">
            <PBtn
              v-if="passkeyDeleteConfirm === pk.id"
              variant="danger"
              size="sm"
              @click="removePasskey(pk.id)"
            >
              {{ $t('common.confirm') }}
            </PBtn>
            <PBtn
              v-if="passkeyDeleteConfirm === pk.id"
              variant="ghost"
              size="sm"
              @click="passkeyDeleteConfirm = null"
            >
              {{ $t('common.cancel') }}
            </PBtn>
            <PBtn
              v-else
              variant="danger"
              size="sm"
              :icon="Delete02Icon"
              @click="passkeyDeleteConfirm = pk.id"
            >
              {{ $t('settings.removePasskey') }}
            </PBtn>
          </div>
        </div>
      </div>
      <p v-else style="color: var(--text-secondary); font-size: var(--text-sm); margin-bottom: var(--space-4);">
        {{ $t('auth.passkeyDescription') }}
      </p>

      <PBtn
        :disabled="passkeyLoading"
        :loading="passkeyLoading"
        @click="addPasskey"
      >
        {{ $t('settings.addPasskey') }}
      </PBtn>
    </div>
  </div>
</template>

<style scoped>
.section {
  margin-bottom: var(--space-4);
}

.section-title {
  font-size: var(--text-lg);
  font-weight: 600;
  margin-bottom: var(--space-4);
}

.form-group { margin-bottom: var(--space-4); }

.form-row {
  display: flex;
  gap: var(--space-4);
}

.form-row .form-group { flex: 1; }

.password-input {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.password-input input { flex: 1; }

.password-strength {
  margin-top: var(--space-2);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
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
  background-color: var(--color-primary-500);
  transition: width var(--transition-base);
}

.success-message {
  background-color: rgba(34, 197, 94, 0.1); color: var(--color-success);
  padding: var(--space-3); border-radius: var(--radius-md); font-size: var(--text-sm); margin-bottom: var(--space-4);
}

.error-message {
  background-color: rgba(239, 68, 68, 0.1); color: var(--color-error);
  padding: var(--space-3); border-radius: var(--radius-md); font-size: var(--text-sm); margin-bottom: var(--space-4);
}

.passkey-list {
  margin-bottom: var(--space-4);
}

.passkey-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-2);
}

.passkey-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.passkey-id {
  font-family: monospace;
  font-size: var(--text-sm);
}

.passkey-date {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.passkey-actions {
  display: flex;
  gap: var(--space-2);
}

.passkey-confirm {
  padding: var(--space-4);
  background-color: var(--bg-secondary);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}
</style>
