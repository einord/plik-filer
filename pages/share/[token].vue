<script setup lang="ts">
import type { FileItem } from '~/types'
import { HugeiconsIcon } from '@hugeicons/vue'
import { Download04Icon, File02Icon } from '@hugeicons/core-free-icons'

definePageMeta({ layout: 'auth' })

const { t } = useI18n()
const route = useRoute()
const token = route.params.token as string

const { data, error } = await useFetch(`/api/shares/public/${token}`)
const previewFile = ref<FileItem | null>(null)

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

function downloadFile(fileId: number) {
  window.open(`/api/shares/public/download/${fileId}?token=${token}`, '_blank')
}

function downloadAll() {
  window.open(`/api/shares/public/download-zip/${token}`, '_blank')
}

const totalSize = computed(() => {
  if (!data.value?.files) return 0
  return data.value.files.reduce((sum: number, f: any) => sum + (f.size || 0), 0)
})
</script>

<template>
  <div style="max-width: 600px;">
    <div v-if="error">
      <h1 style="font-size: var(--text-2xl); font-weight: 700; margin-bottom: var(--space-4);">
        {{ $t('share.publicShareExpired') }}
      </h1>
    </div>

    <div v-else-if="data">
      <h1 style="font-size: var(--text-2xl); font-weight: 700; margin-bottom: var(--space-2);">
        {{ data.label || $t('share.publicShareTitle') }}
      </h1>
      <p style="color: var(--text-secondary); font-size: var(--text-sm); margin-bottom: var(--space-6);">
        {{ $t('share.expiresAt', { date: new Date(data.expiresAt).toLocaleDateString() }) }}
        · {{ data.files.length }} {{ $t('files.files').toLowerCase() }}
        · {{ formatSize(totalSize) }}
      </p>

      <div v-if="data.files.length > 1" style="margin-bottom: var(--space-4);">
        <PBtn :icon="Download04Icon" @click="downloadAll">
          {{ $t('files.downloadAll') }} ({{ formatSize(totalSize) }})
        </PBtn>
      </div>

      <div class="share-file-list">
        <div v-for="file in data.files" :key="file.id" class="share-file-item">
          <div class="share-file-thumb" @click="previewFile = file">
            <img
              v-if="file.thumbnailPath || file.hasThumbnail"
              :src="`/api/shares/public/thumbnail/${file.id}?token=${token}`"
              class="thumbnail"
              loading="lazy"
            />
            <div v-else class="file-icon">
              <HugeiconsIcon :icon="File02Icon" :size="24" />
            </div>
          </div>
          <div class="share-file-info">
            <span class="share-file-name">{{ file.filename }}</span>
            <span class="share-file-size">{{ formatSize(file.size) }}</span>
          </div>
          <PBtn size="sm" :icon="Download04Icon" @click="downloadFile(file.id)">
            {{ $t('files.download') }}
          </PBtn>
        </div>
      </div>
    </div>

    <!-- File preview modal -->
    <FilePreview
      v-if="previewFile"
      :file="previewFile"
      :download-base-url="`/api/shares/public/download`"
      :download-url-suffix="`?token=${token}`"
      @close="previewFile = null"
    />
  </div>
</template>

<style scoped>
.share-file-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.share-file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  gap: var(--space-3);
}

.share-file-thumb {
  flex-shrink: 0;
  cursor: pointer;
}

.thumbnail {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  object-fit: cover;
  transition: opacity var(--transition-fast);
}

.thumbnail:hover {
  opacity: 0.75;
}

.file-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  color: var(--text-secondary);
  transition: color var(--transition-fast);
}

.file-icon:hover {
  color: var(--color-primary-500);
}

.share-file-info {
  flex: 1;
  min-width: 0;
}

.share-file-name {
  display: block;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.share-file-size {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}
</style>
