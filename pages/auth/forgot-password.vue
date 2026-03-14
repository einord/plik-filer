<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { t } = useI18n()

const email = ref('')
const sent = ref(false)
const loading = ref(false)
const error = ref('')

async function handleSubmit() {
  if (!email.value) return
  loading.value = true
  error.value = ''

  try {
    await $fetch('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: email.value },
    })
    sent.value = true
  } catch (e: any) {
    error.value = e.data?.statusMessage || t('errors.serverError')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <h1 style="font-size: var(--text-2xl); font-weight: 700; margin-bottom: var(--space-2);">
      {{ $t('auth.resetPassword') }}
    </h1>

    <div v-if="sent" style="text-align: center;">
      <p style="color: var(--color-success); margin-bottom: var(--space-4);">
        {{ $t('auth.resetPasswordSent') }}
      </p>
      <NuxtLink to="/auth/login" class="btn btn-secondary">
        {{ $t('auth.login') }}
      </NuxtLink>
    </div>

    <form v-else @submit.prevent="handleSubmit">
      <p style="color: var(--text-secondary); margin-bottom: var(--space-6);">
        {{ $t('auth.resetPasswordDescription') }}
      </p>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <div class="form-group">
        <label for="email">{{ $t('auth.email') }}</label>
        <input id="email" v-model="email" type="email" required autocomplete="email" />
      </div>

      <button type="submit" class="btn btn-primary btn-lg" style="width: 100%;" :disabled="loading">
        {{ loading ? $t('common.loading') : $t('auth.resetPassword') }}
      </button>

      <div style="text-align: center; margin-top: var(--space-4);">
        <NuxtLink to="/auth/login" style="font-size: var(--text-sm);">
          {{ $t('common.back') }}
        </NuxtLink>
      </div>
    </form>
  </div>
</template>

<style scoped>
.form-group { margin-bottom: var(--space-4); }
.error-message {
  background-color: rgba(239, 68, 68, 0.1);
  color: var(--color-error);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  margin-bottom: var(--space-4);
}
</style>
