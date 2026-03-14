<script setup lang="ts">
import type { FileItem } from '~/types'
import { HugeiconsIcon } from '@hugeicons/vue'
import {
  Folder01Icon,
  File02Icon,
  Download04Icon,
  Delete02Icon,
  Share08Icon,
  Alert02Icon,
} from '@hugeicons/core-free-icons'

const props = withDefaults(defineProps<{
  files: FileItem[]
  selectedIds: Set<number>
  thumbnailBaseUrl?: string
  canWrite?: boolean
  canShare?: boolean
}>(), {
  thumbnailBaseUrl: '/api/files/thumbnail',
  canWrite: false,
  canShare: false,
})

defineEmits<{
  toggleSelect: [id: number]
  toggleSelectAll: []
  navigateFolder: [id: number, name: string]
  download: [file: FileItem]
  delete: [file: FileItem]
  share: [fileIds: number[]]
}>()

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}
</script>

<template>
  <div class="file-list">
    <div class="file-list-header">
      <div class="file-col-check">
        <input type="checkbox" :checked="selectedIds.size === files.length && files.length > 0" @change="$emit('toggleSelectAll')" />
      </div>
      <div class="file-col-thumb"></div>
      <div class="file-col-name">{{ $t('files.fileName') }}</div>
      <div class="file-col-size">{{ $t('files.fileSize') }}</div>
      <div class="file-col-modified">{{ $t('files.modified') }}</div>
      <div class="file-col-actions"></div>
    </div>

    <div
      v-for="file in files"
      :key="file.id"
      class="file-row"
      :class="{ selected: selectedIds.has(file.id), 'file-missing': file.missing }"
    >
      <div class="file-col-check">
        <input type="checkbox" :checked="selectedIds.has(file.id)" @change="$emit('toggleSelect', file.id)" />
      </div>

      <div class="file-col-thumb">
        <div v-if="file.missing" class="file-icon file-icon-missing">
          <HugeiconsIcon :icon="Alert02Icon" :size="24" />
        </div>
        <div v-else-if="file.isDirectory" class="file-icon folder-icon">
          <HugeiconsIcon :icon="Folder01Icon" :size="24" />
        </div>
        <img
          v-else-if="file.thumbnailPath"
          :src="`${thumbnailBaseUrl}/${file.id}`"
          class="thumbnail"
          loading="lazy"
        />
        <div v-else class="file-icon">
          <HugeiconsIcon :icon="File02Icon" :size="24" />
        </div>
      </div>

      <div class="file-col-name">
        <button
          v-if="file.isDirectory"
          class="folder-link"
          @click="$emit('navigateFolder', file.id, file.filename)"
        >
          {{ file.filename }}
        </button>
        <span v-else class="truncate">{{ file.filename }}</span>
        <span v-if="file.missing" class="file-missing-label">{{ $t('files.fileMissing') }}</span>
      </div>

      <div class="file-col-size">
        {{ file.isDirectory ? '' : formatSize(file.size) }}
      </div>

      <div class="file-col-modified">
        {{ file.createdAt ? new Date(file.createdAt).toLocaleDateString() : '' }}
      </div>

      <div class="file-col-actions">
        <PBtn
          v-if="canShare && !file.isDirectory && !file.missing"
          variant="ghost"
          size="sm"
          :icon="Share08Icon"
          icon-only
          @click="$emit('share', [file.id])"
          :title="$t('share.shareFile')"
        />
        <PBtn
          v-if="!file.isDirectory && !file.missing"
          variant="ghost"
          size="sm"
          :icon="Download04Icon"
          icon-only
          @click="$emit('download', file)"
          :title="$t('files.download')"
        />
        <PBtn
          v-if="canWrite"
          variant="ghost"
          size="sm"
          :icon="Delete02Icon"
          icon-only
          @click="$emit('delete', file)"
          :title="$t('common.delete')"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.file-list {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.file-list-header {
  display: grid;
  grid-template-columns: 40px 48px 1fr 100px 120px 110px;
  padding: var(--space-2) var(--space-3);
  background-color: var(--bg-secondary);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--border-color);
}

.file-row {
  display: grid;
  grid-template-columns: 40px 48px 1fr 100px 120px 110px;
  padding: var(--space-2) var(--space-3);
  align-items: center;
  border-bottom: 1px solid var(--border-color);
  transition: background-color var(--transition-fast);
  font-size: var(--text-sm);
}

.file-row:last-child {
  border-bottom: none;
}

.file-row:hover {
  background-color: var(--bg-secondary);
}

.file-row.file-missing {
  opacity: 0.5;
}

.file-icon-missing {
  color: var(--color-error);
}

.file-missing-label {
  display: inline-block;
  font-size: var(--text-xs);
  color: var(--color-error);
  margin-left: var(--space-2);
}

.file-row.selected {
  background-color: var(--color-primary-50);
}

.dark .file-row.selected {
  background-color: rgba(59, 130, 246, 0.1);
}

.file-col-check {
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-col-thumb {
  display: flex;
  align-items: center;
  justify-content: center;
}

.thumbnail {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  object-fit: cover;
}

.file-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}

.file-icon.folder-icon {
  color: var(--color-warning);
}

.file-col-name {
  min-width: 0;
}

.folder-link {
  background: none;
  border: none;
  color: var(--color-primary-500);
  cursor: pointer;
  font-weight: 500;
  font-size: var(--text-sm);
  padding: 0;
}

.folder-link:hover {
  text-decoration: underline;
}

.file-col-size,
.file-col-modified {
  color: var(--text-secondary);
  font-size: var(--text-xs);
}

.file-col-actions {
  display: flex;
  gap: var(--space-1);
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .file-list-header,
  .file-row {
    grid-template-columns: 40px 40px 1fr 80px 60px;
  }
  .file-col-modified {
    display: none;
  }
}
</style>
