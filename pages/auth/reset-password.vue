<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { t } = useI18n()
const route = useRoute()
const { checkStrength } = usePasswordStrength()

const token = route.query.token as string
const form = reactive({ password: '', confirmPassword: '' })
const loading = ref(false)
const error = ref('')
const success = ref(false)

const passwordStrength = computed(() => {
  if (!form.password) return null
  return checkStrength(form.password)
})

async function handleSubmit() {
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
    await $fetch('/api/auth/reset-password', {
      method: 'POST',
      body: { token, password: form.password },
    })
    success.value = true
  } catch (e: any) {
    error.value = e.data?.statusMessage || t('errors.serverError')
  } finally {
    loading.value = false
  }
}

if (!token) navigateTo('/auth/login')
</script>

<template>
  <div>
    <h1 style="font-size: var(--text-2xl); font-weight: 700; margin-bottom: var(--space-6);">
      {{ $t('auth.resetPassword') }}
    </h1>

    <div v-if="success" style="text-align: center;">
      <p style="color: var(--color-success); margin-bottom: var(--space-4);">
        {{ $t('settings.passwordChanged') }}
      </p>
      <PBtn to="/auth/login">
        {{ $t('auth.login') }}
      </PBtn>
    </div>

    <form v-else @submit.prevent="handleSubmit">
      <div v-if="error" class="error-message">{{ error }}</div>

      <div class="form-group">
        <label for="password">{{ $t('auth.newPassword') }}</label>
        <input id="password" v-model="form.password" type="password" required autocomplete="new-password" />
        <div v-if="passwordStrength" class="password-strength">
          <div class="strength-bar">
            <div class="strength-bar-fill" :style="{ width: `${(passwordStrength.score / 6) * 100}%` }" />
          </div>
          <span class="strength-label">{{ $t(`auth.passwordStrength.${passwordStrength.level}`) }}</span>
        </div>
      </div>

      <div class="form-group">
        <label for="confirm">{{ $t('auth.confirmPassword') }}</label>
        <input id="confirm" v-model="form.confirmPassword" type="password" required autocomplete="new-password" />
      </div>

      <PBtn type="submit" size="lg" block :disabled="loading">
        {{ loading ? $t('common.loading') : $t('auth.resetPassword') }}
      </PBtn>
    </form>
  </div>
</template>

<style scoped>
.form-group { margin-bottom: var(--space-4); }
.error-message {
  background-color: rgba(239, 68, 68, 0.1); color: var(--color-error);
  padding: var(--space-3); border-radius: var(--radius-md); font-size: var(--text-sm); margin-bottom: var(--space-4);
}
.password-strength { margin-top: var(--space-2); display: flex; align-items: center; gap: var(--space-2); }
.strength-bar { flex: 1; height: 4px; background: var(--bg-tertiary); border-radius: var(--radius-full); overflow: hidden; }
.strength-bar-fill { height: 100%; border-radius: var(--radius-full); background-color: var(--color-primary-500); transition: width var(--transition-base); }
.strength-label { font-size: var(--text-xs); font-weight: 500; }
</style>
