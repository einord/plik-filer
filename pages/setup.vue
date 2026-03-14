<script setup lang="ts">
import { HugeiconsIcon } from '@hugeicons/vue'
import { ViewIcon, ViewOffIcon } from '@hugeicons/core-free-icons'

definePageMeta({ layout: 'auth' })

const { t } = useI18n()
const { checkStrength, generatePassword } = usePasswordStrength()

const form = reactive({
  name: '',
  email: '',
  password: '',
})

const error = ref('')
const loading = ref(false)
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
  form.password = generatePassword()
  showPassword.value = true
}

async function handleSubmit() {
  if (!form.name || !form.email || !form.password) return
  if (passwordStrength.value?.level === 'weak') {
    error.value = t('auth.passwordTooWeak')
    return
  }

  loading.value = true
  error.value = ''

  try {
    await $fetch('/api/setup/init', {
      method: 'POST',
      body: form,
    })
    await navigateTo('/files')
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
      {{ $t('setup.welcome') }}
    </h1>
    <p style="color: var(--text-secondary); margin-bottom: var(--space-6);">
      {{ $t('setup.description') }}
    </p>

    <form @submit.prevent="handleSubmit">
      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <div class="form-group">
        <label for="name">{{ $t('auth.name') }}</label>
        <input id="name" v-model="form.name" type="text" required autocomplete="name" />
      </div>

      <div class="form-group">
        <label for="email">{{ $t('auth.email') }}</label>
        <input id="email" v-model="form.email" type="email" required autocomplete="email" />
      </div>

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

      <div style="margin-top: var(--space-4);">
        <PBtn type="submit" size="lg" block :disabled="loading">
          {{ loading ? $t('common.loading') : $t('setup.createAdminAccount') }}
        </PBtn>
      </div>
    </form>
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
</style>
