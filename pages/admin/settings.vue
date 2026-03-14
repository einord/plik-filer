<script setup lang="ts">
import { HugeiconsIcon } from '@hugeicons/vue'
import { Upload04Icon, Delete02Icon, Image02Icon } from '@hugeicons/core-free-icons'

const { t } = useI18n()

const activeTab = ref<'branding' | 'smtp'>('branding')
const success = ref('')
const error = ref('')

// Branding
const branding = reactive({ serviceName: 'plik Filer', logoUrl: '', domainName: '', logoType: 'none' as 'upload' | 'url' | 'none' })
const logoInputMode = ref<'upload' | 'url'>('upload')
const hasUploadedLogo = ref(false)
const uploadedLogoUrl = ref('')
const logoFileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)

// SMTP
const smtp = reactive({
  host: '', port: 587, username: '', password: '',
  fromEmail: '', fromName: '', secure: true,
})
const testEmail = ref('')

// Computed logo preview source
const logoPreviewSrc = computed(() => {
  if (branding.logoType === 'upload' && hasUploadedLogo.value) {
    return uploadedLogoUrl.value
  }
  if (branding.logoType === 'url' && branding.logoUrl) {
    return branding.logoUrl
  }
  return ''
})

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

    // Check if an uploaded logo exists
    await checkUploadedLogo()

    // Set input mode based on current logoType
    if (branding.logoType === 'url') {
      logoInputMode.value = 'url'
    } else {
      logoInputMode.value = 'upload'
    }
  } catch {}
}

async function checkUploadedLogo() {
  if (branding.logoType === 'upload') {
    // If branding says upload, trust it and set the URL
    hasUploadedLogo.value = true
    uploadedLogoUrl.value = `/api/settings/logo?t=${Date.now()}`
  } else {
    // Otherwise probe the endpoint
    try {
      await $fetch('/api/settings/logo', { method: 'HEAD' })
      hasUploadedLogo.value = true
      uploadedLogoUrl.value = `/api/settings/logo?t=${Date.now()}`
    } catch {
      hasUploadedLogo.value = false
    }
  }
}

const logoDragOver = ref(false)

function handleLogoFileInput(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) doLogoUpload(file)
  // Reset input so the same file can be re-selected
  if (logoFileInput.value) logoFileInput.value.value = ''
}

function handleLogoDrop(event: DragEvent) {
  logoDragOver.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) doLogoUpload(file)
}

async function doLogoUpload(file: File) {
  // Client-side validation
  const allowedTypes = ['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    error.value = t('errors.invalidFileType')
    return
  }
  if (file.size > 2 * 1024 * 1024) {
    error.value = t('errors.fileTooLarge', { size: '2 MB' })
    return
  }

  error.value = ''
  success.value = ''
  uploading.value = true

  try {
    const formData = new FormData()
    formData.append('logo', file)
    await $fetch('/api/settings/logo', { method: 'POST', body: formData })
    hasUploadedLogo.value = true
    uploadedLogoUrl.value = `/api/settings/logo?t=${Date.now()}`
    branding.logoType = 'upload'
    success.value = t('branding.logoUploaded')
  } catch {
    error.value = t('errors.serverError')
  } finally {
    uploading.value = false
  }
}

async function removeLogo() {
  error.value = ''
  success.value = ''
  try {
    await $fetch('/api/settings/logo', { method: 'DELETE' })
    hasUploadedLogo.value = false
    uploadedLogoUrl.value = ''
    if (branding.logoType === 'upload') {
      branding.logoType = 'none'
    }
    success.value = t('branding.logoRemoved')
  } catch {
    error.value = t('errors.serverError')
  }
}

async function saveBranding() {
  error.value = ''
  success.value = ''

  // Determine logoType based on input mode
  if (logoInputMode.value === 'upload' && hasUploadedLogo.value) {
    branding.logoType = 'upload'
  } else if (logoInputMode.value === 'url' && branding.logoUrl) {
    branding.logoType = 'url'
  } else {
    branding.logoType = 'none'
  }

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
      <PBtn variant="ghost" size="sm" to="/admin">&larr; {{ $t('common.back') }}</PBtn>
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

        <!-- Logo section -->
        <div class="form-group">
          <label>{{ $t('branding.currentLogo') }}</label>

          <!-- Logo preview -->
          <div v-if="logoPreviewSrc" class="logo-preview">
            <img :src="logoPreviewSrc" alt="Logo" class="logo-preview-img" />
          </div>
          <div v-else class="logo-placeholder">
            <HugeiconsIcon :icon="Image02Icon" :size="32" />
            <span>{{ $t('branding.noLogo') }}</span>
          </div>

          <!-- Logo input mode toggle -->
          <div class="logo-mode-toggle">
            <PBtn
              type="button"
              size="sm"
              :variant="logoInputMode === 'upload' ? 'primary' : 'ghost'"
              :icon="Upload04Icon"
              @click="logoInputMode = 'upload'"
            >
              {{ $t('branding.useUpload') }}
            </PBtn>
            <PBtn
              type="button"
              size="sm"
              :variant="logoInputMode === 'url' ? 'primary' : 'ghost'"
              @click="logoInputMode = 'url'"
            >
              {{ $t('branding.useUrl') }}
            </PBtn>
          </div>

          <!-- Upload mode -->
          <div v-if="logoInputMode === 'upload'" class="logo-upload-area">
            <div
              class="upload-zone"
              :class="{ 'drag-over': logoDragOver, 'is-uploading': uploading }"
              @click="logoFileInput?.click()"
              @dragover.prevent="logoDragOver = true"
              @dragleave="logoDragOver = false"
              @drop.prevent="handleLogoDrop"
            >
              <HugeiconsIcon :icon="Upload04Icon" :size="24" />
              <span v-if="uploading">{{ $t('common.loading') }}</span>
              <template v-else>
                <span>{{ $t('files.dragAndDrop') }}</span>
                <small>{{ $t('files.dragAndDropHint') }}</small>
                <small>{{ $t('branding.logoRequirements') }}</small>
              </template>
            </div>
            <input
              ref="logoFileInput"
              type="file"
              accept=".png,.svg,.jpg,.jpeg,.webp"
              style="display: none;"
              @change="handleLogoFileInput"
            />
            <PBtn
              v-if="hasUploadedLogo"
              type="button"
              variant="danger"
              size="sm"
              :icon="Delete02Icon"
              @click="removeLogo"
            >
              {{ $t('branding.removeLogo') }}
            </PBtn>
          </div>

          <!-- URL mode -->
          <div v-if="logoInputMode === 'url'">
            <input v-model="branding.logoUrl" type="text" :placeholder="$t('branding.logoUrlHint')" />
            <small>{{ $t('branding.logoUrlHint') }}</small>
          </div>
        </div>

        <div class="form-group">
          <label>{{ $t('branding.domainName') }}</label>
          <input v-model="branding.domainName" type="text" />
          <small>{{ $t('branding.domainNameHint') }}</small>
        </div>
        <PBtn type="submit">{{ $t('common.save') }}</PBtn>
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
        <PBtn type="submit">{{ $t('common.save') }}</PBtn>
      </form>

      <hr style="margin: var(--space-6) 0; border-color: var(--border-color);" />

      <h3 style="margin-bottom: var(--space-3);">{{ $t('smtp.sendTestEmail') }}</h3>
      <div style="display: flex; gap: var(--space-2);">
        <input v-model="testEmail" type="email" :placeholder="$t('smtp.testEmail')" style="max-width: 300px;" />
        <PBtn variant="secondary" @click="sendTest">{{ $t('smtp.sendTestEmail') }}</PBtn>
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

.logo-preview {
  margin-bottom: var(--space-3);
  padding: var(--space-4);
  background-color: var(--bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  display: inline-block;
}

.logo-preview-img {
  max-height: 80px;
  max-width: 300px;
  object-fit: contain;
}

.logo-placeholder {
  margin-bottom: var(--space-3);
  padding: var(--space-6);
  background-color: var(--bg-secondary);
  border-radius: var(--radius-md);
  border: 1px dashed var(--border-color);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  color: var(--text-tertiary);
  font-size: var(--text-sm);
}

.logo-mode-toggle {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.logo-upload-area {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  align-items: flex-start;
}

.upload-zone {
  width: 100%;
  padding: var(--space-6);
  border: 2px dashed var(--border-color);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  transition: all var(--transition-fast);
}

.upload-zone:hover,
.upload-zone.drag-over {
  border-color: var(--color-primary-400);
  color: var(--color-primary-600);
  background-color: var(--color-primary-50);
}

.dark .upload-zone:hover,
.dark .upload-zone.drag-over {
  background-color: rgba(59, 130, 246, 0.05);
}

.upload-zone.drag-over {
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.upload-zone.is-uploading {
  pointer-events: none;
  opacity: 0.6;
}

.upload-zone small {
  color: var(--text-tertiary);
  font-size: var(--text-xs);
}

.btn-danger {
  color: var(--color-error);
}

.btn-danger:hover {
  background-color: rgba(239, 68, 68, 0.1);
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
