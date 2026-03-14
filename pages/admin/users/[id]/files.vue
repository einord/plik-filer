<script setup lang="ts">
import type { FileItem } from '~/types'
import {
  Upload04Icon,
  FolderAddIcon,
  ArrowLeft01Icon,
} from '@hugeicons/core-free-icons'

const { t } = useI18n()
const route = useRoute()
const userId = Number(route.params.id)

const fileInputEl = ref<HTMLInputElement | null>(null)
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
    await $fetch(`/api/admin/files/item/${file.id}`, { method: 'DELETE' })
    await loadFiles(currentFolderId.value)
    selectedIds.value.delete(file.id)
  } catch (e: any) {
    error.value = e.data?.statusMessage || t('errors.serverError')
  }
}

function downloadFile(file: FileItem) {
  window.open(`/api/admin/files/download/${file.id}`, '_blank')
}

async function deleteSelected() {
  const count = selectedIds.value.size
  if (!count) return
  if (!confirm(t('files.deleteSelectedConfirm', { count }))) return

  try {
    for (const id of selectedIds.value) {
      await $fetch(`/api/admin/files/item/${id}`, { method: 'DELETE' })
    }
    selectedIds.value.clear()
    await loadFiles(currentFolderId.value)
  } catch (e: any) {
    error.value = e.data?.statusMessage || t('errors.serverError')
  }
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
        <PBtn size="sm" :icon="Upload04Icon" @click="fileInputEl?.click()">
          {{ $t('admin.uploadToUser') }}
        </PBtn>
        <input ref="fileInputEl" type="file" multiple hidden @change="handleFileUpload" />
      </div>
    </div>

    <!-- Upload progress -->
    <div v-if="uploading" class="upload-indicator">
      {{ $t('files.uploading') }}
    </div>

    <NewFolderDialog
      v-if="showNewFolder"
      v-model="newFolderName"
      @submit="createFolder"
      @cancel="showNewFolder = false"
    />

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
        thumbnail-base-url="/api/admin/files/thumbnail"
        @toggle-select="toggleSelect"
        @toggle-select-all="toggleSelectAll"
        @navigate-folder="navigateToFolder"
        @download="downloadFile"
        @delete="deleteFile"
      />

      <!-- Empty state -->
      <div v-else class="empty-state">
        <p>{{ $t('files.noFiles') }}</p>
        <p class="empty-hint">{{ $t('files.dragAndDrop') }}</p>
      </div>

      <SelectionBar
        v-if="selectedIds.size > 0"
        :count="selectedIds.size"
        :can-write="true"
        @download="downloadSelected"
        @delete="deleteSelected"
        @deselect="selectedIds.clear()"
      />

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

.upload-indicator {
  margin-bottom: var(--space-4);
  padding: var(--space-3);
  background-color: var(--bg-secondary);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-secondary);
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
</style>
