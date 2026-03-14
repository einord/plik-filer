<script setup lang="ts">
import type { ShareLink, FileItem } from '~/types'
import { HugeiconsIcon } from '@hugeicons/vue'
import { Delete02Icon, Copy01Icon } from '@hugeicons/core-free-icons'

const { t } = useI18n()

const links = ref<any[]>([])
const loading = ref(true)
const error = ref('')
const showCreate = ref(false)
const userFiles = ref<FileItem[]>([])
const newLink = reactive({ label: '', daysValid: 7, fileIds: [] as number[] })

async function loadLinks() {
  loading.value = true
  try {
    const data = await $fetch('/api/shares')
    links.value = data.shareLinks
  } catch {
    error.value = t('errors.serverError')
  } finally {
    loading.value = false
  }
}

async function loadUserFiles() {
  const data = await $fetch('/api/files')
  userFiles.value = (data.files as FileItem[]).filter((f) => !f.isDirectory)
}

async function createLink() {
  if (!newLink.fileIds.length) return
  try {
    const data = await $fetch('/api/shares', {
      method: 'POST',
      body: newLink,
    })
    showCreate.value = false
    newLink.label = ''
    newLink.daysValid = 7
    newLink.fileIds = []
    await loadLinks()

    // Copy to clipboard
    if (data.shareLink?.url) {
      await navigator.clipboard.writeText(data.shareLink.url)
    }
  } catch (e: any) {
    error.value = e.data?.statusMessage || t('errors.serverError')
  }
}

async function deleteLink(id: number) {
  if (!confirm(t('share.deleteLinkConfirm'))) return
  try {
    await $fetch(`/api/shares/${id}`, { method: 'DELETE' })
    await loadLinks()
  } catch {
    error.value = t('errors.serverError')
  }
}

async function copyLink(token: string) {
  const config = useRuntimeConfig()
  const url = `${window.location.origin}/share/${token}`
  await navigator.clipboard.writeText(url)
}

function toggleFileId(id: number) {
  const idx = newLink.fileIds.indexOf(id)
  if (idx >= 0) newLink.fileIds.splice(idx, 1)
  else newLink.fileIds.push(id)
}

onMounted(async () => {
  await loadLinks()
  await loadUserFiles()
})
</script>

<template>
  <div>
    <div class="page-header">
      <h1>{{ $t('share.shareLinks') }}</h1>
      <button class="btn btn-primary btn-sm" @click="showCreate = true">
        {{ $t('share.createShareLink') }}
      </button>
    </div>

    <!-- Create dialog -->
    <div v-if="showCreate" class="card" style="margin-bottom: var(--space-4);">
      <h3 style="margin-bottom: var(--space-4);">{{ $t('share.createShareLink') }}</h3>

      <div class="form-group">
        <label>{{ $t('share.label') }}</label>
        <input v-model="newLink.label" type="text" />
      </div>

      <div class="form-group">
        <label>{{ $t('share.daysValid') }}</label>
        <input v-model.number="newLink.daysValid" type="number" min="1" max="90" />
      </div>

      <div class="form-group">
        <label>{{ $t('share.selectFiles') }}</label>
        <div class="file-select-list">
          <label
            v-for="file in userFiles"
            :key="file.id"
            class="file-select-item"
          >
            <input
              type="checkbox"
              :checked="newLink.fileIds.includes(file.id)"
              @change="toggleFileId(file.id)"
            />
            <span>{{ file.filename }}</span>
          </label>
          <p v-if="!userFiles.length" style="color: var(--text-secondary); font-size: var(--text-sm);">
            {{ $t('files.noFiles') }}
          </p>
        </div>
      </div>

      <div style="display: flex; gap: var(--space-2);">
        <button class="btn btn-primary btn-sm" @click="createLink" :disabled="!newLink.fileIds.length">
          {{ $t('share.createShareLink') }}
        </button>
        <button class="btn btn-ghost btn-sm" @click="showCreate = false">
          {{ $t('common.cancel') }}
        </button>
      </div>
    </div>

    <div v-if="error" class="error-message">{{ error }}</div>

    <div v-if="loading" class="empty-state">{{ $t('common.loading') }}</div>

    <div v-else-if="links.length === 0" class="empty-state">
      {{ $t('share.noShareLinks') }}
    </div>

    <div v-else class="links-list">
      <div v-for="link in links" :key="link.id" class="card link-card">
        <div class="link-header">
          <div>
            <strong>{{ link.label || $t('share.shareLink') }}</strong>
            <span
              class="badge"
              :class="link.isExpired ? 'badge-error' : 'badge-success'"
            >
              {{ link.isExpired ? $t('share.expired') : $t('share.active') }}
            </span>
          </div>
          <div class="link-actions">
            <button v-if="!link.isExpired" class="btn btn-ghost btn-sm" @click="copyLink(link.token)">
              <HugeiconsIcon :icon="Copy01Icon" :size="18" />
              {{ $t('share.copyLink') }}
            </button>
            <button class="btn btn-ghost btn-sm btn-icon" @click="deleteLink(link.id)" :title="$t('common.delete')">
              <HugeiconsIcon :icon="Delete02Icon" :size="18" />
            </button>
          </div>
        </div>

        <p class="link-meta">
          {{ $t('share.expiresAt', { date: new Date(link.expiresAt).toLocaleDateString() }) }}
          · {{ link.files?.length || 0 }} {{ $t('files.files').toLowerCase() }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.page-header h1 {
  font-size: var(--text-xl);
  font-weight: 700;
}

.form-group { margin-bottom: var(--space-4); }

.file-select-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: var(--space-2);
}

.file-select-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-2);
  cursor: pointer;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
}

.file-select-item:hover {
  background-color: var(--bg-secondary);
}

.links-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.link-card {
  padding: var(--space-4);
}

.link-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-2);
}

.link-header .badge {
  margin-left: var(--space-2);
}

.link-actions {
  display: flex;
  gap: var(--space-1);
}

.link-meta {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.empty-state {
  text-align: center;
  padding: var(--space-12);
  color: var(--text-secondary);
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
