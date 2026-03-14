<script setup lang="ts">
import { HugeiconsIcon } from '@hugeicons/vue'
import { Key01Icon } from '@hugeicons/core-free-icons'

definePageMeta({ layout: 'auth' })

const { t } = useI18n()
const { login, loginWithPasskey } = useAuth()

const form = reactive({ email: '', password: '' })
const error = ref('')
const loading = ref(false)
const passkeyLoading = ref(false)

async function handleSubmit() {
  if (!form.email || !form.password) return
  loading.value = true
  error.value = ''

  try {
    await login(form.email, form.password)
    await navigateTo('/files')
  } catch (e: any) {
    error.value = e.data?.statusMessage || t('auth.loginFailed')
  } finally {
    loading.value = false
  }
}

async function handlePasskeyLogin() {
  passkeyLoading.value = true
  error.value = ''

  try {
    await loginWithPasskey(form.email || undefined)
    await navigateTo('/files')
  } catch (e: any) {
    // User may have cancelled the browser dialog
    if (e.name === 'NotAllowedError') {
      error.value = t('auth.loginFailed')
    } else {
      error.value = e.data?.statusMessage || e.message || t('auth.loginFailed')
    }
  } finally {
    passkeyLoading.value = false
  }
}
</script>

<template>
  <div>
    <h1 style="font-size: var(--text-2xl); font-weight: 700; margin-bottom: var(--space-2);">
      {{ $t('auth.login') }}
    </h1>
    <p style="color: var(--text-secondary); margin-bottom: var(--space-6);">
      {{ $t('common.appName') }}
    </p>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <!-- Passkey login button -->
    <button
      type="button"
      class="btn btn-primary btn-lg passkey-btn"
      :disabled="passkeyLoading"
      @click="handlePasskeyLogin"
    >
      <HugeiconsIcon :icon="Key01Icon" :size="20" />
      {{ passkeyLoading ? $t('common.loading') : $t('auth.usePasskey') }}
    </button>
    <p class="passkey-hint">{{ $t('auth.passkeyDescription') }}</p>

    <div class="divider">
      <span>{{ $t('auth.usePassword') }}</span>
    </div>

    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="email">{{ $t('auth.email') }}</label>
        <input id="email" v-model="form.email" type="email" required autocomplete="email" />
      </div>

      <div class="form-group">
        <label for="password">{{ $t('auth.password') }}</label>
        <input id="password" v-model="form.password" type="password" required autocomplete="current-password" />
      </div>

      <button type="submit" class="btn btn-primary btn-lg" style="width: 100%;" :disabled="loading">
        {{ loading ? $t('common.loading') : $t('auth.login') }}
      </button>

      <div style="text-align: center; margin-top: var(--space-4);">
        <NuxtLink to="/auth/forgot-password" style="font-size: var(--text-sm);">
          {{ $t('auth.forgotPassword') }}
        </NuxtLink>
      </div>
    </form>
  </div>
</template>

<style scoped>
.form-group {
  margin-bottom: var(--space-4);
}

.error-message {
  background-color: rgba(239, 68, 68, 0.1);
  color: var(--color-error);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  margin-bottom: var(--space-4);
}

.passkey-btn {
  width: 100%;
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
