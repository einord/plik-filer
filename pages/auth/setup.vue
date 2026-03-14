<script setup lang="ts">
import { HugeiconsIcon } from '@hugeicons/vue'
import { ViewIcon, ViewOffIcon } from '@hugeicons/core-free-icons'

definePageMeta({ layout: 'auth' })

const { t } = useI18n()
const route = useRoute()
const { setupAccount } = useAuth()
const { checkStrength, generatePassword } = usePasswordStrength()

const token = route.query.token as string

const form = reactive({ email: '', password: '', confirmPassword: '' })
const userName = ref('')
const error = ref('')
const loading = ref(false)
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

      <form @submit.prevent="handleSubmit">
        <div v-if="error" class="error-message">
          {{ error }}
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

        <div class="form-group">
          <label for="confirmPassword">{{ $t('auth.confirmPassword') }}</label>
          <input id="confirmPassword" v-model="form.confirmPassword" type="password" required autocomplete="new-password" />
        </div>

        <div style="margin-top: var(--space-4);">
          <PBtn type="submit" size="lg" block :disabled="loading">
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
</style>
