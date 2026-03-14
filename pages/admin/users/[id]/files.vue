<script setup lang="ts">
import type { FileItem } from '~/types'
import { HugeiconsIcon } from '@hugeicons/vue'
import {
  Folder01Icon,
  File02Icon,
  Download04Icon,
  Delete02Icon,
  Upload04Icon,
  FolderAddIcon,
  ArrowLeft01Icon,
} from '@hugeicons/core-free-icons'

const { t } = useI18n()
const route = useRoute()
const userId = Number(route.params.id)

const files = ref<FileItem[]>([])
const targetUser = ref<{ id: number; name: string; email: string } | null>(null)
const currentFolderId = ref<number | null>(null)
const breadcrumbs = ref<{ id: number | null; name: string }[]>([])
const selectedIds = ref<Set<number>>(new Set())
const loading = ref(true)
const showNewFolder = ref(false)
const newFolderName = ref('')
const dragOver = ref(false)
const error = ref('')
const uploading = ref(false)

async function loadFiles(parentId: number | null = null) {
  loading.value = true
  error.value = ''
  try {
    const query = parentId ? `?parentId=${parentId}` : ''
    const data = await $fetch(`/api/admin/files/${userId}${query}`)
    files.value = data.files as FileItem[]
    targetUser.value = data.user as { id: number; name: string; email: string }
    currentFolderId.value = parentId
  } catch (e: any) {
    error.value = e.data?.statusMessage || t('errors.serverError')
  } finally {
    loading.value = false
  }
}

async function navigateToFolder(folderId: number | null, folderName?: string) {
  if (folderId === null) {
    breadcrumbs.value = []
  } else if (folderName) {
    const existingIndex = breadcrumbs.value.findIndex((b) => b.id === folderId)
    if (existingIndex >= 0) {
      breadcrumbs.value = breadcrumbs.value.slice(0, existingIndex + 1)
    } else {
      breadcrumbs.value.push({ id: folderId, name: folderName })
    }
  }
  await loadFiles(folderId)
  selectedIds.value.clear()
}

async function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files?.length) return
  await doUpload(Array.from(input.files))
  input.value = ''
}

async function handleDrop(event: DragEvent) {
  dragOver.value = false
  const droppedFiles = event.dataTransfer?.files
  if (!droppedFiles?.length) return
  await doUpload(Array.from(droppedFiles))
}

async function doUpload(fileList: File[]) {
  uploading.value = true
  error.value = ''
  try {
    const formData = new FormData()
    for (const file of fileList) {
      formData.append('files', file)
    }
    if (currentFolderId.value) {
      formData.append('parentId', String(currentFolderId.value))
    }
    await $fetch(`/api/admin/files/${userId}/upload`, {
      method: 'POST',
      body: formData,
    })
    await loadFiles(currentFolderId.value)
  } catch (e: any) {
    error.value = e.data?.statusMessage || t('files.uploadFailed')
  } finally {
    uploading.value = false
  }
}

async function createFolder() {
  if (!newFolderName.value.trim()) return
  try {
    await $fetch(`/api/admin/files/${userId}/folder`, {
      method: 'POST',
      body: { name: newFolderName.value, parentId: currentFolderId.value },
    })
    showNewFolder.value = false
    newFolderName.value = ''
    await loadFiles(currentFolderId.value)
  } catch (e: any) {
    error.value = e.data?.statusMessage || t('errors.serverError')
  }
}

async function deleteFile(file: FileItem) {
  const msg = file.isDirectory
    ? t('files.deleteFolderConfirm', { name: file.filename })
    : t('files.deleteFileConfirm', { name: file.filename })

  if (!confirm(msg)) return

  try {
    await $fetch(`/api/admin/files/${file.id}`, { method: 'DELETE' })
    await loadFiles(currentFolderId.value)
    selectedIds.value.delete(file.id)
  } catch (e: any) {
    error.value = e.data?.statusMessage || t('errors.serverError')
  }
}

function downloadFile(file: FileItem) {
  window.open(`/api/admin/files/download/${file.id}`, '_blank')
}

async function downloadSelected() {
  const ids = Array.from(selectedIds.value)
  if (!ids.length) return

  try {
    const response = await fetch('/api/admin/files/download-zip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileIds: ids }),
    })
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `plik-filer-${Date.now()}.zip`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e: any) {
    error.value = t('errors.serverError')
  }
}

function toggleSelect(id: number) {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id)
  } else {
    selectedIds.value.add(id)
  }
}

function toggleSelectAll() {
  if (selectedIds.value.size === files.value.length) {
    selectedIds.value.clear()
  } else {
    files.value.forEach((f) => selectedIds.value.add(f.id))
  }
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

onMounted(() => {
  loadFiles()
})
</script>

<template>
  <div>
    <div class="page-header">
      <div class="header-left">
        <PBtn variant="ghost" size="sm" :icon="ArrowLeft01Icon" to="/admin">
          {{ $t('admin.backToUsers') }}
        </PBtn>
        <h1 v-if="targetUser">
          {{ $t('admin.userFiles', { name: targetUser.name }) }}
        </h1>
        <p v-if="targetUser" class="user-email">{{ targetUser.email }}</p>
      </div>
    </div>

    <div class="page-subheader">
      <div class="breadcrumbs">
        <PBtn variant="ghost" size="sm" @click="navigateToFolder(null)">
          {{ $t('files.files') }}
        </PBtn>
        <template v-for="crumb in breadcrumbs" :key="crumb.id">
          <span class="breadcrumb-sep">/</span>
          <PBtn variant="ghost" size="sm" @click="navigateToFolder(crumb.id, crumb.name)">
            {{ crumb.name }}
          </PBtn>
        </template>
      </div>

      <div class="page-actions">
        <PBtn variant="secondary" size="sm" :icon="FolderAddIcon" @click="showNewFolder = true">
          {{ $t('files.newFolder') }}
        </PBtn>
        <label class="btn btn-primary btn-sm upload-btn">
          <HugeiconsIcon :icon="Upload04Icon" :size="18" />
          {{ $t('admin.uploadToUser') }}
          <input type="file" multiple hidden @change="handleFileUpload" />
        </label>
      </div>
    </div>

    <!-- Upload progress -->
    <div v-if="uploading" class="upload-indicator">
      {{ $t('files.uploading') }}
    </div>

    <!-- New folder dialog -->
    <div v-if="showNewFolder" class="new-folder card">
      <form @submit.prevent="createFolder" class="new-folder-form">
        <input
          v-model="newFolderName"
          :placeholder="$t('files.folderName')"
          autofocus
          @keydown.esc="showNewFolder = false"
        />
        <PBtn type="submit" size="sm">{{ $t('common.save') }}</PBtn>
        <PBtn type="button" variant="ghost" size="sm" @click="showNewFolder = false">{{ $t('common.cancel') }}</PBtn>
      </form>
    </div>

    <!-- Error -->
    <div v-if="error" class="error-message">
      {{ error }}
      <PBtn variant="ghost" size="sm" @click="error = ''">{{ $t('common.close') }}</PBtn>
    </div>

    <!-- Drop zone -->
    <div
      class="drop-zone"
      :class="{ 'drag-over': dragOver }"
      @dragover.prevent="dragOver = true"
      @dragleave="dragOver = false"
      @drop.prevent="handleDrop"
    >
      <!-- Selection actions -->
      <div v-if="selectedIds.size > 0" class="selection-bar">
        <span>{{ $t('files.selected', { count: selectedIds.size }) }}</span>
        <PBtn size="sm" @click="downloadSelected">
          {{ $t('files.downloadSelected') }}
        </PBtn>
        <PBtn variant="ghost" size="sm" @click="selectedIds.clear()">
          {{ $t('files.deselectAll') }}
        </PBtn>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="empty-state">
        {{ $t('common.loading') }}
      </div>

      <!-- File list -->
      <div v-else-if="files.length > 0" class="file-list">
        <div class="file-list-header">
          <div class="file-col-check">
            <input type="checkbox" :checked="selectedIds.size === files.length && files.length > 0" @change="toggleSelectAll" />
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
          :class="{ selected: selectedIds.has(file.id) }"
        >
          <div class="file-col-check">
            <input type="checkbox" :checked="selectedIds.has(file.id)" @change="toggleSelect(file.id)" />
          </div>

          <div class="file-col-thumb">
            <div v-if="file.isDirectory" class="file-icon folder-icon">
              <HugeiconsIcon :icon="Folder01Icon" :size="24" />
            </div>
            <img
              v-else-if="file.thumbnailPath"
              :src="`/api/admin/files/thumbnail/${file.id}`"
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
              @click="navigateToFolder(file.id, file.filename)"
            >
              {{ file.filename }}
            </button>
            <span v-else class="truncate">{{ file.filename }}</span>
          </div>

          <div class="file-col-size">
            {{ file.isDirectory ? '' : formatSize(file.size) }}
          </div>

          <div class="file-col-modified">
            {{ file.createdAt ? new Date(file.createdAt).toLocaleDateString() : '' }}
          </div>

          <div class="file-col-actions">
            <PBtn
              v-if="!file.isDirectory"
              variant="ghost"
              size="sm"
              :icon="Download04Icon"
              icon-only
              @click="downloadFile(file)"
              :title="$t('files.download')"
            />
            <PBtn
              variant="ghost"
              size="sm"
              :icon="Delete02Icon"
              icon-only
              @click="deleteFile(file)"
              :title="$t('common.delete')"
            />
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else class="empty-state">
        <p>{{ $t('files.noFiles') }}</p>
        <p class="empty-hint">{{ $t('files.dragAndDrop') }}</p>
      </div>

      <!-- Drag overlay -->
      <div v-if="dragOver" class="drag-overlay">
        <p>{{ $t('files.dragAndDrop') }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-header {
  margin-bottom: var(--space-3);
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.header-left h1 {
  font-size: var(--text-xl);
  font-weight: 700;
  margin: 0;
}

.user-email {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
}

.page-subheader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
  flex-wrap: wrap;
  gap: var(--space-2);
}

.breadcrumbs {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.breadcrumb-sep {
  color: var(--text-tertiary);
}

.page-actions {
  display: flex;
  gap: var(--space-2);
}

.upload-btn {
  cursor: pointer;
}

.upload-indicator {
  margin-bottom: var(--space-4);
  padding: var(--space-3);
  background-color: var(--bg-secondary);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.new-folder {
  padding: var(--space-3);
  margin-bottom: var(--space-4);
}

.new-folder-form {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.new-folder-form input {
  flex: 1;
  max-width: 300px;
}

.drop-zone {
  position: relative;
  min-height: 300px;
}

.drag-over {
  outline: 2px dashed var(--color-primary-500);
  outline-offset: -2px;
  border-radius: var(--radius-lg);
}

.drag-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(59, 130, 246, 0.05);
  border-radius: var(--radius-lg);
  font-size: var(--text-lg);
  font-weight: 500;
  color: var(--color-primary-500);
  pointer-events: none;
}

.selection-bar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background-color: var(--bg-tertiary);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-3);
  font-size: var(--text-sm);
}

.file-list {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.file-list-header {
  display: grid;
  grid-template-columns: 40px 48px 1fr 100px 120px 80px;
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
  grid-template-columns: 40px 48px 1fr 100px 120px 80px;
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

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  color: var(--text-secondary);
}

.empty-hint {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  margin-top: var(--space-2);
}

.error-message {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: rgba(239, 68, 68, 0.1);
  color: var(--color-error);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  margin-bottom: var(--space-4);
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
