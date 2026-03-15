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

const emit = defineEmits<{
  toggleSelect: [id: number]
  toggleSelectAll: []
  navigateFolder: [id: number, name: string]
  download: [file: FileItem]
  delete: [file: FileItem]
  share: [fileIds: number[]]
  preview: [file: FileItem]
  moveFiles: [fileIds: number[], targetParentId: number | null]
}>()

const draggedFileIds = ref<number[]>([])
const dropTargetId = ref<number | null>(null)

function onDragStart(event: DragEvent, file: FileItem) {
  if (props.selectedIds.has(file.id) && props.selectedIds.size > 0) {
    draggedFileIds.value = Array.from(props.selectedIds)
  } else {
    draggedFileIds.value = [file.id]
  }
  event.dataTransfer?.setData('application/json', JSON.stringify({ fileIds: draggedFileIds.value }))
  event.dataTransfer!.effectAllowed = 'move'
}

function onDragOverFolder(event: DragEvent, folder: FileItem) {
  if (draggedFileIds.value.includes(folder.id)) return
  event.dataTransfer!.dropEffect = 'move'
  dropTargetId.value = folder.id
}

function onDragLeaveFolder() {
  dropTargetId.value = null
}

function onDropFolder(event: DragEvent, folder: FileItem) {
  dropTargetId.value = null
  const raw = event.dataTransfer?.getData('application/json')
  if (!raw) return
  try {
    const { fileIds } = JSON.parse(raw) as { fileIds: number[] }
    if (fileIds.includes(folder.id)) return
    emit('moveFiles', fileIds, folder.id)
  } catch {
    // Invalid data
  }
}

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
      :class="{
        selected: selectedIds.has(file.id),
        'file-missing': file.missing,
        'drop-target': file.isDirectory && dropTargetId === file.id,
      }"
      draggable="true"
      @dragstart="onDragStart($event, file)"
      @dragover.prevent="file.isDirectory ? onDragOverFolder($event, file) : undefined"
      @dragleave="file.isDirectory ? onDragLeaveFolder() : undefined"
      @drop.prevent="file.isDirectory ? onDropFolder($event, file) : undefined"
      @click="$emit('toggleSelect', file.id)"
    >
      <div class="file-col-thumb" @click.stop="!file.isDirectory && !file.missing && $emit('preview', file)">
        <div v-if="file.missing" class="file-icon file-icon-missing">
          <HugeiconsIcon :icon="Alert02Icon" :size="24" />
        </div>
        <div v-else-if="file.isDirectory" class="file-icon folder-icon">
          <HugeiconsIcon :icon="Folder01Icon" :size="24" />
        </div>
        <img
          v-else-if="file.thumbnailPath"
          :src="`${thumbnailBaseUrl}/${file.id}`"
          class="thumbnail thumbnail-clickable"
          loading="lazy"
        />
        <div v-else class="file-icon file-icon-clickable">
          <HugeiconsIcon :icon="File02Icon" :size="24" />
        </div>
      </div>

      <div class="file-col-name">
        <button
          v-if="file.isDirectory"
          class="folder-link"
          @click.stop="$emit('navigateFolder', file.id, file.filename)"
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

      <div class="file-col-actions" @click.stop>
        <PBtn
          v-if="canShare && !file.missing"
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
  grid-template-columns: 48px 1fr 100px 120px 110px;
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
  grid-template-columns: 48px 1fr 100px 120px 110px;
  padding: var(--space-2) var(--space-3);
  align-items: center;
  border-bottom: 1px solid var(--border-color);
  transition: background-color var(--transition-fast);
  font-size: var(--text-sm);
  cursor: pointer;
  user-select: none;
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

.thumbnail-clickable {
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.thumbnail-clickable:hover {
  opacity: 0.75;
}

.file-icon-clickable {
  cursor: pointer;
  transition: color var(--transition-fast);
}

.file-icon-clickable:hover {
  color: var(--color-primary-500);
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

.file-row.drop-target {
  outline: 2px dashed var(--color-primary-500);
  outline-offset: -2px;
  background-color: rgba(59, 130, 246, 0.08);
}

.file-row[draggable="true"] {
  cursor: grab;
}

.file-row[draggable="true"]:active {
  cursor: grabbing;
}

@media (max-width: 768px) {
  .file-list-header,
  .file-row {
    grid-template-columns: 40px 1fr 80px 60px;
  }
  .file-col-modified {
    display: none;
  }
}
</style>
