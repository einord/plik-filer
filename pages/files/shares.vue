<script setup lang="ts">
import type { ShareLink, FileItem } from '~/types'
import { HugeiconsIcon } from '@hugeicons/vue'
import { Delete02Icon, Copy01Icon } from '@hugeicons/core-free-icons'

const { t } = useI18n()

const links = ref<any[]>([])
const loading = ref(true)
const error = ref('')

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
  const url = `${window.location.origin}/share/${token}`
  await navigator.clipboard.writeText(url)
}

onMounted(async () => {
  await loadLinks()
})
</script>

<template>
  <div>
    <div class="page-header">
      <h1>{{ $t('share.shareLinks') }}</h1>
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
            <PBtn v-if="!link.isExpired" variant="ghost" size="sm" :icon="Copy01Icon" @click="copyLink(link.token)">
              {{ $t('share.copyLink') }}
            </PBtn>
            <PBtn variant="ghost" size="sm" :icon="Delete02Icon" icon-only @click="deleteLink(link.id)" :title="$t('common.delete')" />
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
