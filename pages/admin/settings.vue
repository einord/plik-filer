<script setup lang="ts">
const { t } = useI18n()

const activeTab = ref<'branding' | 'smtp'>('branding')
const success = ref('')
const error = ref('')

// Branding
const branding = reactive({ serviceName: 'plik Filer', logoUrl: '', domainName: '' })

// SMTP
const smtp = reactive({
  host: '', port: 587, username: '', password: '',
  fromEmail: '', fromName: '', secure: true,
})
const testEmail = ref('')

async function loadSettings() {
  try {
    const [brandingData, smtpData] = await Promise.all([
      $fetch('/api/settings/branding'),
      $fetch('/api/settings/smtp'),
    ])
    Object.assign(branding, brandingData.branding)
    if (smtpData.smtp) {
      Object.assign(smtp, smtpData.smtp)
    }
  } catch {}
}

async function saveBranding() {
  error.value = ''
  success.value = ''
  try {
    await $fetch('/api/settings/branding', { method: 'PUT', body: branding })
    success.value = t('branding.brandingUpdated')
  } catch {
    error.value = t('errors.serverError')
  }
}

async function saveSmtp() {
  error.value = ''
  success.value = ''
  try {
    await $fetch('/api/settings/smtp', { method: 'PUT', body: smtp })
    success.value = t('smtp.saved')
  } catch {
    error.value = t('errors.serverError')
  }
}

async function sendTest() {
  if (!testEmail.value) return
  error.value = ''
  success.value = ''
  try {
    await $fetch('/api/settings/smtp-test', { method: 'POST', body: { to: testEmail.value } })
    success.value = t('smtp.testEmailSent')
  } catch (e: any) {
    error.value = e.data?.statusMessage || t('errors.serverError')
  }
}

onMounted(loadSettings)
</script>

<template>
  <div>
    <div class="page-header">
      <NuxtLink to="/admin" class="btn btn-ghost btn-sm">← {{ $t('common.back') }}</NuxtLink>
      <h1>{{ $t('admin.settings') }}</h1>
    </div>

    <div class="tabs">
      <button
        class="tab"
        :class="{ active: activeTab === 'branding' }"
        @click="activeTab = 'branding'"
      >
        {{ $t('admin.branding') }}
      </button>
      <button
        class="tab"
        :class="{ active: activeTab === 'smtp' }"
        @click="activeTab = 'smtp'"
      >
        {{ $t('admin.smtp') }}
      </button>
    </div>

    <div v-if="success" class="success-message">{{ success }}</div>
    <div v-if="error" class="error-message">{{ error }}</div>

    <!-- Branding -->
    <div v-if="activeTab === 'branding'" class="card">
      <form @submit.prevent="saveBranding">
        <div class="form-group">
          <label>{{ $t('branding.serviceName') }}</label>
          <input v-model="branding.serviceName" type="text" />
          <small>{{ $t('branding.serviceNameHint') }}</small>
        </div>
        <div class="form-group">
          <label>{{ $t('branding.logoUrl') }}</label>
          <input v-model="branding.logoUrl" type="text" />
          <small>{{ $t('branding.logoUrlHint') }}</small>
        </div>
        <div class="form-group">
          <label>{{ $t('branding.domainName') }}</label>
          <input v-model="branding.domainName" type="text" />
          <small>{{ $t('branding.domainNameHint') }}</small>
        </div>
        <button type="submit" class="btn btn-primary">{{ $t('common.save') }}</button>
      </form>
    </div>

    <!-- SMTP -->
    <div v-if="activeTab === 'smtp'" class="card">
      <form @submit.prevent="saveSmtp">
        <div class="form-row">
          <div class="form-group" style="flex: 2;">
            <label>{{ $t('smtp.host') }}</label>
            <input v-model="smtp.host" type="text" placeholder="smtp.example.com" />
          </div>
          <div class="form-group" style="flex: 1;">
            <label>{{ $t('smtp.port') }}</label>
            <input v-model.number="smtp.port" type="number" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>{{ $t('smtp.username') }}</label>
            <input v-model="smtp.username" type="text" />
          </div>
          <div class="form-group">
            <label>{{ $t('smtp.password') }}</label>
            <input v-model="smtp.password" type="password" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>{{ $t('smtp.fromEmail') }}</label>
            <input v-model="smtp.fromEmail" type="email" placeholder="noreply@example.com" />
          </div>
          <div class="form-group">
            <label>{{ $t('smtp.fromName') }}</label>
            <input v-model="smtp.fromName" type="text" placeholder="plik Filer" />
          </div>
        </div>
        <div class="form-group">
          <label class="permission-toggle">
            <input type="checkbox" v-model="smtp.secure" />
            <span>{{ $t('smtp.secure') }}</span>
          </label>
        </div>
        <button type="submit" class="btn btn-primary">{{ $t('common.save') }}</button>
      </form>

      <hr style="margin: var(--space-6) 0; border-color: var(--border-color);" />

      <h3 style="margin-bottom: var(--space-3);">{{ $t('smtp.sendTestEmail') }}</h3>
      <div style="display: flex; gap: var(--space-2);">
        <input v-model="testEmail" type="email" :placeholder="$t('smtp.testEmail')" style="max-width: 300px;" />
        <button class="btn btn-secondary" @click="sendTest">{{ $t('smtp.sendTestEmail') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.page-header h1 {
  font-size: var(--text-xl);
  font-weight: 700;
}

.tabs {
  display: flex;
  gap: var(--space-1);
  margin-bottom: var(--space-4);
}

.tab {
  padding: var(--space-2) var(--space-4);
  background: none;
  border: 1px solid transparent;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-secondary);
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  font-family: inherit;
}

.tab.active {
  color: var(--color-primary-600);
  border-bottom-color: var(--color-primary-600);
}

.form-group {
  margin-bottom: var(--space-4);
  flex: 1;
}

.form-group small {
  display: block;
  margin-top: var(--space-1);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.form-row {
  display: flex;
  gap: var(--space-4);
}

.permission-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  font-size: var(--text-sm);
}

.success-message {
  background-color: rgba(34, 197, 94, 0.1);
  color: var(--color-success);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
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
</style>
