<script setup lang="ts">
import type { FileItem } from '~/types'
import { HugeiconsIcon } from '@hugeicons/vue'
import {
  Upload04Icon,
  FolderAddIcon,
  PauseIcon,
  PlayIcon,
  Cancel01Icon,
  Tick02Icon,
  Alert02Icon,
  Loading03Icon,
  Share08Icon,
  Copy01Icon,
} from '@hugeicons/core-free-icons'

const { t } = useI18n()
const { user } = useAuth()
const {
  uploads,
  isUploading,
  uploadFiles,
  pauseUpload,
  resumeUpload,
  cancelUpload,
  clearUploads,
  onAllComplete,
  formatSpeed,
  formatTime,
} = useUpload()

const fileInputEl = ref<HTMLInputElement | null>(null)
const files = ref<FileItem[]>([])
const currentFolderId = ref<number | null>(null)
const breadcrumbs = ref<{ id: number | null; name: string }[]>([])
const selectedIds = ref<Set<number>>(new Set())
const loading = ref(true)
const showNewFolder = ref(false)
const newFolderName = ref('')
const dragOver = ref(false)
const error = ref('')
const breadcrumbDropTarget = ref<number | null | undefined>(undefined)
const storageStats = ref<{ totalFiles: number; totalUsed: number; maxAllowed: number; percentage: number } | null>(null)
const previewFile = ref<FileItem | null>(null)

// Share dialog state
const showShareDialog = ref(false)
const shareFileIds = ref<number[]>([])
const shareLabel = ref('')
const shareDaysValid = ref(7)
const shareResult = ref<{ url: string } | null>(null)
const shareLoading = ref(false)
const shareCopied = ref(false)

function openShareDialog(fileIds: number[]) {
  shareFileIds.value = fileIds
  shareLabel.value = ''
  shareDaysValid.value = 7
  shareResult.value = null
  shareLoading.value = false
  shareCopied.value = false
  showShareDialog.value = true
}

async function createShareLink() {
  if (!shareFileIds.value.length) return
  shareLoading.value = true
  try {
    const data = await $fetch('/api/shares', {
      method: 'POST',
      body: {
        fileIds: shareFileIds.value,
        label: shareLabel.value || undefined,
        daysValid: shareDaysValid.value,
      },
    })
    if (data.shareLink?.url) {
      shareResult.value = { url: data.shareLink.url }
    }
  } catch (e: any) {
    error.value = e.data?.statusMessage || t('errors.serverError')
  } finally {
    shareLoading.value = false
  }
}

async function copyShareUrl() {
  if (!shareResult.value?.url) return
  await navigator.clipboard.writeText(shareResult.value.url)
  shareCopied.value = true
}

function closeShareDialog() {
  showShareDialog.value = false
  shareFileIds.value = []
  shareLabel.value = ''
  shareDaysValid.value = 7
  shareResult.value = null
  shareLoading.value = false
  shareCopied.value = false
}

async function loadStorageStats() {
  try {
    storageStats.value = await $fetch('/api/files/stats')
  } catch {
    // Silently fail - storage indicator is non-critical
  }
}

// Register callback for when all uploads finish
onAllComplete(async () => {
  await loadFiles(currentFolderId.value)
  await loadStorageStats()
  setTimeout(() => clearUploads(), 3000)
})

async function loadFiles(parentId: number | null = null) {
  loading.value = true
  error.value = ''
  try {
    const query = parentId ? `?parentId=${parentId}` : ''
    const data = await $fetch(`/api/files${query}`)
    files.value = data.files as FileItem[]
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
  try {
    await uploadFiles(fileList, currentFolderId.value)
  } catch (e: any) {
    error.value = e.message || t('files.uploadFailed')
  }
}

async function createFolder() {
  if (!newFolderName.value.trim()) return
  try {
    await $fetch('/api/files/folder', {
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
    await $fetch(`/api/files/${file.id}`, { method: 'DELETE' })
    await loadFiles(currentFolderId.value)
    await loadStorageStats()
    selectedIds.value.delete(file.id)
  } catch (e: any) {
    error.value = e.data?.statusMessage || t('errors.serverError')
  }
}

function downloadFile(file: FileItem) {
  window.open(`/api/files/download/${file.id}`, '_blank')
}

async function deleteSelected() {
  const count = selectedIds.value.size
  if (!count) return
  if (!confirm(t('files.deleteSelectedConfirm', { count }))) return

  try {
    for (const id of selectedIds.value) {
      await $fetch(`/api/files/${id}`, { method: 'DELETE' })
    }
    selectedIds.value.clear()
    await loadFiles(currentFolderId.value)
    await loadStorageStats()
  } catch (e: any) {
    error.value = e.data?.statusMessage || t('errors.serverError')
  }
}

async function downloadSelected() {
  const ids = Array.from(selectedIds.value)
  if (!ids.length) return

  try {
    const response = await fetch('/api/files/download-zip', {
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

async function moveFiles(fileIds: number[], targetParentId: number | null) {
  try {
    await $fetch('/api/files/move', {
      method: 'POST',
      body: { fileIds, targetParentId },
    })
    selectedIds.value.clear()
    await loadFiles(currentFolderId.value)
  } catch (e: any) {
    error.value = e.data?.statusMessage || t('errors.serverError')
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

function getStatusIconComponent(status: string) {
  switch (status) {
    case 'pending': return Loading03Icon
    case 'uploading': return Upload04Icon
    case 'paused': return PauseIcon
    case 'complete': return Tick02Icon
    case 'error': return Alert02Icon
    default: return null
  }
}

onMounted(() => {
  loadFiles()
  loadStorageStats()
})
</script>

<template>
  <div>
    <div class="page-header">
      <div class="breadcrumbs">
        <div
          class="breadcrumb-item"
          :class="{ 'breadcrumb-drop-target': breadcrumbDropTarget === null }"
          @dragover.prevent="breadcrumbDropTarget = null"
          @dragleave="breadcrumbDropTarget = undefined"
          @drop.prevent="(e: DragEvent) => { breadcrumbDropTarget = undefined; const raw = e.dataTransfer?.getData('application/json'); if (raw) { try { const { fileIds } = JSON.parse(raw); moveFiles(fileIds, null); } catch {} } }"
        >
          <PBtn variant="ghost" size="sm" @click="navigateToFolder(null)">
            {{ $t('files.files') }}
          </PBtn>
        </div>
        <template v-for="crumb in breadcrumbs" :key="crumb.id">
          <span class="breadcrumb-sep">/</span>
          <div
            class="breadcrumb-item"
            :class="{ 'breadcrumb-drop-target': breadcrumbDropTarget === crumb.id }"
            @dragover.prevent="breadcrumbDropTarget = crumb.id"
            @dragleave="breadcrumbDropTarget = undefined"
            @drop.prevent="(e: DragEvent) => { breadcrumbDropTarget = undefined; const raw = e.dataTransfer?.getData('application/json'); if (raw) { try { const { fileIds } = JSON.parse(raw); moveFiles(fileIds, crumb.id); } catch {} } }"
          >
            <PBtn variant="ghost" size="sm" @click="navigateToFolder(crumb.id, crumb.name)">
              {{ crumb.name }}
            </PBtn>
          </div>
        </template>
      </div>

      <div class="page-actions" v-if="user?.canWrite">
        <PBtn variant="secondary" size="sm" :icon="FolderAddIcon" @click="showNewFolder = true">
          {{ $t('files.newFolder') }}
        </PBtn>
        <PBtn size="sm" :icon="Upload04Icon" @click="fileInputEl?.click()">
          {{ $t('files.upload') }}
        </PBtn>
        <input ref="fileInputEl" type="file" multiple hidden @change="handleFileUpload" />
      </div>
    </div>

    <!-- Storage usage indicator -->
    <StorageIndicator
      v-if="storageStats"
      :total-used="storageStats.totalUsed"
      :max-allowed="storageStats.maxAllowed"
    />

    <!-- Upload progress list -->
    <div v-if="uploads.size > 0" class="upload-progress-list">
      <div v-for="[id, upload] in uploads" :key="id" class="upload-progress-item card">
        <div class="upload-header">
          <div class="upload-file-info">
            <span
              class="upload-status-badge"
              :class="{
                'badge-uploading': upload.status === 'uploading',
                'badge-paused': upload.status === 'paused',
                'badge-complete': upload.status === 'complete',
                'badge-error': upload.status === 'error',
                'badge-pending': upload.status === 'pending',
              }"
            >
              <HugeiconsIcon
                v-if="getStatusIconComponent(upload.status)"
                :icon="getStatusIconComponent(upload.status)!"
                :size="12"
                :class="{ 'icon-spin': upload.status === 'pending' }"
              />
            </span>
            <span class="upload-filename truncate">{{ upload.filename }}</span>
          </div>
          <div class="upload-controls">
            <PBtn
              v-if="upload.status === 'uploading'"
              variant="ghost"
              size="sm"
              :icon="PauseIcon"
              icon-only
              @click="pauseUpload(id)"
              :title="$t('files.pauseUpload')"
            />
            <PBtn
              v-else-if="upload.status === 'paused'"
              variant="ghost"
              size="sm"
              :icon="PlayIcon"
              icon-only
              @click="resumeUpload(id)"
              :title="$t('files.resumeUpload')"
            />
            <PBtn
              v-if="upload.status === 'uploading' || upload.status === 'paused' || upload.status === 'pending'"
              variant="ghost"
              size="sm"
              :icon="Cancel01Icon"
              icon-only
              class="upload-cancel-btn"
              @click="cancelUpload(id)"
              :title="$t('files.cancelUpload')"
            />
          </div>
        </div>

        <div class="upload-details">
          <span v-if="upload.status === 'uploading'" class="upload-stats">
            {{ upload.percentage }}%
            <span class="upload-separator">&middot;</span>
            {{ formatSpeed(upload.speed) }}
            <span v-if="upload.timeRemaining > 0" class="upload-separator">&middot;</span>
            <span v-if="upload.timeRemaining > 0">
              {{ $t('files.timeRemaining', { time: formatTime(upload.timeRemaining) }) }}
            </span>
          </span>
          <span v-else-if="upload.status === 'paused'" class="upload-stats upload-stats-paused">
            {{ upload.percentage }}% &middot; {{ $t('files.pauseUpload').replace('Pausa u', 'Pausad u').replace('Pause u', 'Paused') }}
          </span>
          <span v-else-if="upload.status === 'complete'" class="upload-stats upload-stats-complete">
            {{ $t('files.uploadComplete') }}
          </span>
          <span v-else-if="upload.status === 'error'" class="upload-stats upload-stats-error">
            {{ upload.error }}
          </span>
          <span v-else-if="upload.status === 'pending'" class="upload-stats upload-stats-pending">
            {{ $t('common.loading') }}
          </span>
        </div>

        <div class="progress-bar">
          <div
            class="progress-bar-fill"
            :class="{
              'progress-error': upload.status === 'error',
              'progress-done': upload.status === 'complete',
              'progress-paused': upload.status === 'paused',
            }"
            :style="{ width: `${upload.percentage}%` }"
          />
        </div>
      </div>
    </div>

    <NewFolderDialog
      v-if="showNewFolder"
      v-model="newFolderName"
      @submit="createFolder"
      @cancel="showNewFolder = false"
    />

    <!-- Share dialog -->
    <PModal v-if="showShareDialog" @close="closeShareDialog">
      <div class="modal-body">
        <template v-if="!shareResult">
          <h3 class="modal-title">{{ $t('share.sharingFiles', { count: shareFileIds.length }) }}</h3>

          <div class="share-dialog-form">
            <div class="form-group">
              <label>{{ $t('share.label') }}</label>
              <input v-model="shareLabel" type="text" :placeholder="$t('common.optional')" />
            </div>

            <div class="form-group">
              <label>{{ $t('share.daysValid') }}</label>
              <input v-model.number="shareDaysValid" type="number" min="1" max="90" />
            </div>
          </div>

          <div class="modal-actions">
            <PBtn variant="ghost" size="sm" @click="closeShareDialog">
              {{ $t('common.cancel') }}
            </PBtn>
            <PBtn size="sm" @click="createShareLink" :disabled="shareLoading">
              {{ $t('share.createLink') }}
            </PBtn>
          </div>
        </template>

        <template v-else>
          <h3 class="modal-title" style="color: var(--color-success);">{{ $t('share.linkReady') }}</h3>

          <div class="share-link-result">
            <input type="text" :value="shareResult.url" readonly class="share-link-input" />
            <PBtn size="sm" :icon="Copy01Icon" @click="copyShareUrl">
              {{ shareCopied ? $t('common.copied') : $t('common.copy') }}
            </PBtn>
          </div>

          <div class="modal-actions">
            <PBtn variant="ghost" size="sm" @click="closeShareDialog">
              {{ $t('common.close') }}
            </PBtn>
          </div>
        </template>
      </div>
    </PModal>

    <!-- Error -->
    <div v-if="error" class="error-message">
      {{ error }}
      <PBtn variant="ghost" size="sm" @click="error = ''">{{ $t('common.close') }}</PBtn>
    </div>

    <!-- Drop zone (only for external file uploads, not internal moves) -->
    <div
      v-if="user?.canWrite"
      class="drop-zone"
      :class="{ 'drag-over': dragOver }"
      @dragover.prevent="(e: DragEvent) => { if (e.dataTransfer?.types.includes('Files')) dragOver = true }"
      @dragleave="dragOver = false"
      @drop.prevent="(e: DragEvent) => { dragOver = false; if (e.dataTransfer?.types.includes('Files')) handleDrop(e) }"
    >
      <!-- Loading -->
      <div v-if="loading" class="empty-state">
        {{ $t('common.loading') }}
      </div>

      <!-- File list -->
      <FileTable
        v-else-if="files.length > 0"
        :files="files"
        :selected-ids="selectedIds"
        :can-write="true"
        :can-share="true"
        @toggle-select="toggleSelect"
        @toggle-select-all="toggleSelectAll"
        @navigate-folder="navigateToFolder"
        @download="downloadFile"
        @delete="deleteFile"
        @share="openShareDialog"
        @preview="previewFile = $event"
        @move-files="moveFiles"
      />

      <!-- Empty state -->
      <div v-else class="empty-state">
        <p>{{ $t('files.noFiles') }}</p>
        <p class="empty-hint">{{ $t('files.dragAndDrop') }}</p>
      </div>

      <SelectionBar
        v-if="selectedIds.size > 0"
        :count="selectedIds.size"
        :can-share="true"
        :can-write="true"
        @download="downloadSelected"
        @share="openShareDialog(Array.from(selectedIds))"
        @delete="deleteSelected"
        @deselect="selectedIds.clear()"
      />

      <!-- Drag overlay -->
      <div v-if="dragOver" class="drag-overlay">
        <p>{{ $t('files.dragAndDrop') }}</p>
      </div>
    </div>

    <!-- Read-only view (no drop zone) -->
    <div v-else>
      <FileTable
        v-if="files.length > 0"
        :files="files"
        :selected-ids="selectedIds"
        @toggle-select="toggleSelect"
        @toggle-select-all="toggleSelectAll"
        @navigate-folder="navigateToFolder"
        @download="downloadFile"
        @delete="deleteFile"
        @preview="previewFile = $event"
        @move-files="moveFiles"
      />
      <div v-else class="empty-state">{{ $t('files.noFiles') }}</div>
    </div>

    <!-- File preview modal -->
    <FilePreview
      v-if="previewFile"
      :file="previewFile"
      @close="previewFile = null"
    />
  </div>
</template>

<style scoped>
.page-header {
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

.breadcrumb-item {
  display: inline-flex;
  border-radius: var(--radius-md);
}

.breadcrumb-drop-target {
  outline: 2px dashed var(--color-primary-500);
  outline-offset: -2px;
  background-color: rgba(59, 130, 246, 0.08);
  border-radius: var(--radius-md);
}

.breadcrumb-sep {
  color: var(--text-tertiary);
}

.page-actions {
  display: flex;
  gap: var(--space-2);
}

.upload-progress-list {
  margin-bottom: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.upload-progress-item {
  padding: var(--space-3);
}

.upload-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-1);
}

.upload-file-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  flex: 1;
}

.upload-filename {
  font-size: var(--text-sm);
  font-weight: 500;
}

.upload-status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 700;
  flex-shrink: 0;
}

.badge-uploading {
  background-color: rgba(59, 130, 246, 0.15);
  color: var(--color-primary-500);
}

.badge-paused {
  background-color: rgba(245, 158, 11, 0.15);
  color: var(--color-warning);
}

.badge-complete {
  background-color: rgba(34, 197, 94, 0.15);
  color: var(--color-success);
}

.badge-error {
  background-color: rgba(239, 68, 68, 0.15);
  color: var(--color-error);
}

.badge-pending {
  background-color: rgba(107, 114, 128, 0.15);
  color: var(--text-secondary);
}

.upload-controls {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-shrink: 0;
}

.upload-cancel-btn {
  color: var(--color-error);
}

.upload-cancel-btn:hover:not(:disabled) {
  color: var(--color-error);
  background-color: rgba(239, 68, 68, 0.1);
}

.upload-details {
  margin-bottom: var(--space-2);
}

.upload-stats {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.upload-separator {
  margin: 0 var(--space-1);
}

.upload-stats-paused {
  color: var(--color-warning);
}

.upload-stats-complete {
  color: var(--color-success);
}

.upload-stats-error {
  color: var(--color-error);
}

.upload-stats-pending {
  color: var(--text-tertiary);
}

.progress-error { background-color: var(--color-error) !important; }
.progress-done { background-color: var(--color-success) !important; }
.progress-paused { background-color: var(--color-warning) !important; }

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

.modal-body {
  padding: var(--space-4);
  min-width: 350px;
}

.modal-title {
  font-size: var(--text-base);
  font-weight: 600;
  margin-bottom: var(--space-3);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.share-dialog-form {
  display: flex;
  gap: var(--space-4);
  margin-bottom: var(--space-3);
  flex-wrap: wrap;
}

.share-dialog-form .form-group {
  flex: 1;
  min-width: 160px;
}

.share-dialog-form .form-group label {
  display: block;
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: var(--space-1);
}

.share-link-result {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  margin-bottom: var(--space-3);
}

.share-link-input {
  flex: 1;
  font-size: var(--text-sm);
  background-color: var(--bg-secondary);
  cursor: text;
}
</style>
