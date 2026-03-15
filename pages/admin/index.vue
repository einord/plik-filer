<script setup lang="ts">
import { HugeiconsIcon } from '@hugeicons/vue'
import { Delete02Icon, Settings02Icon, UserAdd01Icon, Folder01Icon, UserMultipleIcon, File02Icon, DatabaseIcon, Link04Icon, SentIcon, Copy01Icon, Cancel01Icon, ViewIcon, ViewOffIcon, Upload04Icon, Edit02Icon } from '@hugeicons/core-free-icons'

const { t } = useI18n()

const users = ref<any[]>([])
const loading = ref(true)
const error = ref('')
const showCreateUser = ref(false)
const newUserName = ref('')
const newUserEmail = ref('')
const createUserLoading = ref(false)
const setupLinkResult = ref<{ url: string; userId: number; emailSent: boolean } | null>(null)
const linkCopied = ref(false)
const userStats = ref<Record<number, { totalFiles: number; totalUsed: number; maxFileSize: number }>>({})
const editingQuotaUserId = ref<number | null>(null)
const editQuotaValueGB = ref(100)
const editingUser = ref<any | null>(null)
const editForm = ref({ name: '', email: '', canRead: true, canWrite: true })
const dashboardStats = ref<any>(null)

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMinutes < 1) return t('time.justNow')
  if (diffMinutes < 60) return t('time.minutesAgo', { count: diffMinutes })
  if (diffHours < 24) return t('time.hoursAgo', { count: diffHours })
  return t('time.daysAgo', { count: diffDays })
}

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const [usersData, statsData] = await Promise.all([
      $fetch('/api/users'),
      $fetch('/api/admin/stats'),
    ])
    users.value = usersData.users
    dashboardStats.value = statsData

    // Load storage stats for all users
    const statsPromises = usersData.users.map(async (u: any) => {
      try {
        const stats = await $fetch(`/api/users/${u.id}/stats`)
        return { id: u.id, stats }
      } catch {
        return { id: u.id, stats: { totalFiles: 0, totalUsed: 0, maxFileSize: u.maxFileSize } }
      }
    })
    const statsResults = await Promise.all(statsPromises)
    const statsMap: Record<number, any> = {}
    for (const r of statsResults) {
      statsMap[r.id] = r.stats
    }
    userStats.value = statsMap
  } catch {
    error.value = t('errors.serverError')
  } finally {
    loading.value = false
  }
}

function startEditQuota(user: any) {
  editingQuotaUserId.value = user.id
  // Convert bytes to GB for editing
  editQuotaValueGB.value = Math.round(user.maxFileSize / (1024 * 1024 * 1024))
}

async function saveQuota(userId: number) {
  try {
    const maxFileSize = editQuotaValueGB.value * 1024 * 1024 * 1024
    await $fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      body: { maxFileSize },
    })
    editingQuotaUserId.value = null
    await loadData()
  } catch {
    error.value = t('errors.serverError')
  }
}

function getUsagePercentage(userId: number): number {
  const stats = userStats.value[userId]
  if (!stats || !stats.maxFileSize) return 0
  return Math.round((stats.totalUsed / stats.maxFileSize) * 100)
}

async function createUserDirect() {
  if (!newUserName.value.trim()) return
  createUserLoading.value = true
  try {
    await $fetch('/api/users', {
      method: 'POST',
      body: {
        name: newUserName.value.trim(),
        email: newUserEmail.value.trim() || undefined,
      },
    })
    newUserName.value = ''
    newUserEmail.value = ''
    showCreateUser.value = false
    await loadData()
  } catch (e: any) {
    error.value = e.data?.statusMessage || t('errors.serverError')
  } finally {
    createUserLoading.value = false
  }
}

async function sendSetupLink(userId: number) {
  try {
    const data = await $fetch(`/api/users/${userId}/setup-link`, {
      method: 'POST',
      body: { sendEmail: true },
    })
    setupLinkResult.value = { url: data.setupUrl, userId, emailSent: data.emailSent }
    await loadData()
  } catch (e: any) {
    error.value = e.data?.statusMessage || t('errors.serverError')
  }
}

async function removeSetupLink(userId: number) {
  try {
    await $fetch(`/api/users/${userId}/setup-link`, { method: 'DELETE' })
    await loadData()
  } catch (e: any) {
    error.value = e.data?.statusMessage || t('errors.serverError')
  }
}

function openEditUser(user: any) {
  editingUser.value = user
  editForm.value = {
    name: user.name,
    email: user.email || '',
    canRead: user.canRead,
    canWrite: user.canWrite,
  }
}

async function saveEditUser() {
  if (!editingUser.value) return
  try {
    const body: Record<string, any> = {
      canRead: editForm.value.canRead,
      canWrite: editForm.value.canWrite,
    }
    if (!editingUser.value.setupCompleted) {
      body.name = editForm.value.name.trim()
      body.email = editForm.value.email.trim() || null
    }
    await $fetch(`/api/users/${editingUser.value.id}`, {
      method: 'PATCH',
      body,
    })
    editingUser.value = null
    await loadData()
  } catch (e: any) {
    error.value = e.data?.statusMessage || t('errors.serverError')
  }
}

async function copySetupLink(userId: number) {
  try {
    const data = await $fetch(`/api/users/${userId}/setup-link`, {
      method: 'POST',
      body: { sendEmail: false },
    })
    setupLinkResult.value = { url: data.setupUrl, userId, emailSent: false }
    await loadData()
  } catch (e: any) {
    error.value = e.data?.statusMessage || t('errors.serverError')
  }
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    linkCopied.value = true
    setTimeout(() => { linkCopied.value = false }, 2000)
  } catch {
    // Clipboard not available
  }
}

async function toggleUser(userId: number, isActive: boolean) {
  try {
    await $fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      body: { isActive: !isActive },
    })
    await loadData()
  } catch {
    error.value = t('errors.serverError')
  }
}

async function updatePermissions(userId: number, field: string, value: boolean) {
  try {
    await $fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      body: { [field]: value },
    })
    await loadData()
  } catch {
    error.value = t('errors.serverError')
  }
}

async function deleteUser(userId: number) {
  if (!confirm(t('admin.deleteUserConfirm'))) return
  try {
    await $fetch(`/api/users/${userId}`, { method: 'DELETE' })
    await loadData()
  } catch {
    error.value = t('errors.serverError')
  }
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

onMounted(loadData)
</script>

<template>
  <div>
    <div class="page-header">
      <h1>{{ $t('admin.dashboard') }}</h1>
      <div style="display: flex; gap: var(--space-2);">
        <PBtn variant="secondary" size="sm" :icon="Settings02Icon" to="/admin/settings">
          {{ $t('admin.settings') }}
        </PBtn>
        <PBtn size="sm" :icon="UserAdd01Icon" @click="showCreateUser = true">
          {{ $t('admin.createUserDirect') }}
        </PBtn>
      </div>
    </div>

    <div v-if="error" class="error-message">{{ error }}</div>

    <!-- Dashboard stats -->
    <div v-if="dashboardStats && !loading" class="stats-grid">
      <div class="stat-card card">
        <div class="stat-icon stat-icon-users">
          <HugeiconsIcon :icon="UserMultipleIcon" :size="22" />
        </div>
        <div class="stat-number">{{ dashboardStats.activeUsers }}/{{ dashboardStats.totalUsers }}</div>
        <div class="stat-label">{{ $t('admin.activeUsers') }}</div>
      </div>
      <div class="stat-card card">
        <div class="stat-icon stat-icon-files">
          <HugeiconsIcon :icon="File02Icon" :size="22" />
        </div>
        <div class="stat-number">{{ dashboardStats.totalFiles }}</div>
        <div class="stat-label">{{ $t('admin.totalFiles') }}</div>
      </div>
      <div class="stat-card card">
        <div class="stat-icon stat-icon-storage">
          <HugeiconsIcon :icon="DatabaseIcon" :size="22" />
        </div>
        <div class="stat-number">{{ formatSize(dashboardStats.totalStorage) }}</div>
        <div class="stat-label">{{ $t('admin.totalStorage') }}</div>
      </div>
      <div class="stat-card card">
        <div class="stat-icon stat-icon-links">
          <HugeiconsIcon :icon="Link04Icon" :size="22" />
        </div>
        <div class="stat-number">{{ dashboardStats.totalShareLinks }}</div>
        <div class="stat-label">{{ $t('admin.activeShareLinks') }}</div>
      </div>
    </div>

    <!-- Recent uploads -->
    <div v-if="dashboardStats && !loading" class="card" style="margin-bottom: var(--space-4);">
      <h2 style="font-size: var(--text-lg); font-weight: 600; margin-bottom: var(--space-3);">
        {{ $t('admin.recentUploads') }}
      </h2>
      <div v-if="dashboardStats.recentUploads.length === 0" class="empty-state" style="padding: var(--space-4);">
        {{ $t('admin.noRecentUploads') }}
      </div>
      <div v-else class="recent-uploads-list">
        <NuxtLink
          v-for="file in dashboardStats.recentUploads"
          :key="file.id"
          :to="`/admin/users/${file.userId}/files`"
          class="recent-upload-row"
        >
          <div class="recent-upload-info">
            <span class="recent-upload-filename">{{ file.filename }}</span>
            <span class="recent-upload-meta">{{ formatSize(file.size) }}</span>
          </div>
          <div class="recent-upload-right">
            <span class="recent-upload-user">{{ file.userName }}</span>
            <span class="recent-upload-time">{{ timeAgo(file.createdAt) }}</span>
          </div>
        </NuxtLink>
      </div>
    </div>

    <!-- Create user dialog -->
    <PModal v-if="showCreateUser" @close="showCreateUser = false">
      <div class="modal-body">
        <h3 class="modal-title">{{ $t('admin.createUserDirect') }}</h3>
        <div class="form-group">
          <label>{{ $t('auth.name') }} *</label>
          <input v-model="newUserName" type="text" :placeholder="t('auth.name')" />
        </div>
        <div class="form-group">
          <label>{{ $t('auth.email') }} ({{ $t('common.optional') }})</label>
          <input v-model="newUserEmail" type="email" :placeholder="t('auth.email')" />
        </div>
        <div class="modal-actions">
          <PBtn variant="ghost" size="sm" @click="showCreateUser = false">
            {{ $t('common.cancel') }}
          </PBtn>
          <PBtn size="sm" :disabled="createUserLoading || !newUserName.trim()" @click="createUserDirect">
            {{ createUserLoading ? $t('common.loading') : $t('admin.createUserDirect') }}
          </PBtn>
        </div>
      </div>
    </PModal>

    <!-- Edit user modal -->
    <PModal v-if="editingUser" @close="editingUser = null">
      <div class="modal-body">
        <h3 class="modal-title">{{ $t('admin.editUser') }}: {{ editingUser.name }}</h3>

        <div class="form-group">
          <label>{{ $t('auth.name') }}</label>
          <input v-model="editForm.name" type="text" :disabled="editingUser.setupCompleted" />
        </div>

        <div class="form-group">
          <label>{{ $t('auth.email') }}</label>
          <input v-model="editForm.email" type="email" :placeholder="$t('common.optional')" :disabled="editingUser.setupCompleted" />
        </div>

        <div class="form-group">
          <label class="permission-toggle">
            <input type="checkbox" v-model="editForm.canRead" />
            <span>{{ $t('admin.canRead') }}</span>
          </label>
        </div>

        <div class="form-group">
          <label class="permission-toggle">
            <input type="checkbox" v-model="editForm.canWrite" />
            <span>{{ $t('admin.canWrite') }}</span>
          </label>
        </div>

        <div class="modal-footer">
          <PBtn variant="danger" size="sm" :icon="Delete02Icon" @click="deleteUser(editingUser.id); editingUser = null">
            {{ $t('common.delete') }}
          </PBtn>
          <div class="modal-actions">
            <PBtn variant="ghost" size="sm" @click="toggleUser(editingUser.id, editingUser.isActive); editingUser = null">
              {{ editingUser.isActive ? $t('admin.deactivateUser') : $t('admin.activateUser') }}
            </PBtn>
            <PBtn variant="ghost" size="sm" @click="editingUser = null">
              {{ $t('common.cancel') }}
            </PBtn>
            <PBtn size="sm" @click="saveEditUser">
              {{ $t('common.save') }}
            </PBtn>
          </div>
        </div>
      </div>
    </PModal>

    <!-- Setup link result -->
    <PModal v-if="setupLinkResult" @close="setupLinkResult = null">
      <div class="modal-body">
        <h3 class="modal-title">
          {{ setupLinkResult.emailSent ? $t('admin.setupLinkSent') : $t('admin.setupLinkGenerated') }}
        </h3>
        <code style="font-size: var(--text-xs); word-break: break-all; display: block; padding: var(--space-3); background: var(--bg-secondary); border-radius: var(--radius-md);">{{ setupLinkResult.url }}</code>
        <div class="modal-actions">
          <PBtn variant="ghost" size="sm" @click="setupLinkResult = null">
            {{ $t('common.close') }}
          </PBtn>
          <PBtn size="sm" :icon="Copy01Icon" @click="copyToClipboard(setupLinkResult.url)">
            {{ linkCopied ? $t('common.copied') : $t('share.copyLink') }}
          </PBtn>
        </div>
      </div>
    </PModal>

    <!-- Users list -->
    <div class="card" v-if="!loading">
      <h2 style="font-size: var(--text-lg); font-weight: 600; margin-bottom: var(--space-4);">
        {{ $t('admin.userList') }} ({{ users.length }})
      </h2>

      <div v-if="users.length === 0" class="empty-state">
        {{ $t('admin.noUsers') }}
      </div>

      <div v-else class="users-list">
        <div v-for="u in users" :key="u.id" class="user-row" :class="{ 'user-inactive': !u.isActive }">
          <div class="user-row-top">
            <div class="user-info">
              <div class="user-name-row">
                <strong>{{ u.name }}</strong>
                <span class="badge" :class="u.role === 'admin' ? 'badge-info' : 'badge-success'">
                  {{ u.role }}
                </span>
                <span v-if="!u.isActive" class="badge badge-error">
                  {{ $t('share.inactive') }}
                </span>
                <span v-if="!u.setupCompleted && u.role !== 'admin'" class="badge badge-warning">
                  {{ $t('admin.awaitingSetup') }}
                </span>
                <span v-if="u.role !== 'admin'" class="permission-icons">
                  <HugeiconsIcon :icon="u.canRead ? ViewIcon : ViewOffIcon" :size="14" :title="u.canRead ? $t('admin.canRead') : $t('admin.cannotRead')" :class="u.canRead ? 'perm-on' : 'perm-off'" />
                  <HugeiconsIcon :icon="Upload04Icon" :size="14" :title="u.canWrite ? $t('admin.canWrite') : $t('admin.cannotWrite')" :class="u.canWrite ? 'perm-on' : 'perm-off'" />
                </span>
              </div>
              <div style="font-size: var(--text-sm); color: var(--text-secondary);">
                {{ u.email || '—' }}
              </div>
            </div>

            <!-- Storage usage -->
            <div class="user-storage" v-if="userStats[u.id]">
              <div class="storage-label">
                <span class="storage-text">{{ $t('admin.storageUsage') }}: {{ formatSize(userStats[u.id].totalUsed) }} / {{ formatSize(userStats[u.id].maxFileSize) }}</span>
              </div>
              <div class="storage-bar">
                <div
                  class="storage-bar-fill"
                  :class="{
                    'storage-warning': getUsagePercentage(u.id) >= 90 && getUsagePercentage(u.id) < 95,
                    'storage-danger': getUsagePercentage(u.id) >= 95,
                  }"
                  :style="{ width: `${Math.min(getUsagePercentage(u.id), 100)}%` }"
                />
              </div>
              <!-- Inline quota editor -->
              <div v-if="editingQuotaUserId === u.id" class="quota-editor">
                <input
                  v-model.number="editQuotaValueGB"
                  type="number"
                  min="1"
                  class="quota-input"
                />
                <span class="quota-unit">GB</span>
                <PBtn size="sm" @click="saveQuota(u.id)">{{ $t('common.save') }}</PBtn>
                <PBtn variant="ghost" size="sm" @click="editingQuotaUserId = null">{{ $t('common.cancel') }}</PBtn>
              </div>
              <PBtn v-else variant="ghost" size="sm" class="quota-edit-btn" @click="startEditQuota(u)">
                {{ $t('admin.editQuota') }}
              </PBtn>
            </div>
          </div>

          <div class="user-row-bottom" v-if="u.role !== 'admin'">
            <div class="user-actions">
              <PBtn variant="ghost" size="sm" :icon="Edit02Icon" @click="openEditUser(u)">
                {{ $t('common.edit') }}
              </PBtn>
              <PDropdown v-if="!u.setupCompleted" :icon="Link04Icon">
                <template #trigger>{{ $t('admin.setupLink') }}</template>
                <PDropdownItem :icon="Copy01Icon" @click="copySetupLink(u.id)">
                  {{ $t('admin.copySetupLink') }}
                </PDropdownItem>
                <PDropdownItem v-if="u.email" :icon="SentIcon" @click="sendSetupLink(u.id)">
                  {{ $t('admin.sendSetupLink') }}
                </PDropdownItem>
                <PDropdownItem v-if="u.hasSetupToken" :icon="Cancel01Icon" danger @click="removeSetupLink(u.id)">
                  {{ $t('admin.removeSetupLink') }}
                </PDropdownItem>
              </PDropdown>
              <PBtn variant="ghost" size="sm" :icon="Folder01Icon" :to="`/admin/users/${u.id}/files`" :title="$t('admin.manageFiles')">
                {{ $t('admin.manageFiles') }}
              </PBtn>
            </div>
          </div>

          <!-- Admin user: only files button -->
          <div class="user-row-bottom" v-else>
            <div class="user-actions">
              <PBtn variant="ghost" size="sm" :icon="Folder01Icon" :to="`/admin/users/${u.id}/files`" :title="$t('admin.manageFiles')">
                {{ $t('admin.manageFiles') }}
              </PBtn>
            </div>
          </div>
        </div>
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

.form-group { margin-bottom: var(--space-3); }

.users-list {
  display: flex;
  flex-direction: column;
}

.user-row {
  display: flex;
  flex-direction: column;
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--border-color);
  gap: var(--space-2);
}

.user-row:last-child { border-bottom: none; }

.user-row.user-inactive {
  opacity: 0.5;
}

.user-row-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.user-row-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.user-info { flex: 1; min-width: 200px; }

.user-name-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.permission-icons {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  margin-left: var(--space-1);
}

.perm-on {
  color: var(--color-success, #22c55e);
}

.perm-off {
  color: var(--text-tertiary);
  opacity: 0.4;
}

.permission-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  cursor: pointer;
  white-space: nowrap;
}

.permission-toggle input[type="checkbox"] {
  width: auto;
  padding: 0;
  margin: 0;
}

.user-actions {
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
}

.user-storage {
  flex: 1 1 auto;
  min-width: 200px;
  max-width: 400px;
}

.storage-label {
  margin-bottom: var(--space-1);
}

.storage-text {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.storage-bar {
  height: 4px;
  background-color: var(--bg-tertiary);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: var(--space-1);
}

.storage-bar-fill {
  height: 100%;
  background-color: var(--color-primary-500);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.storage-bar-fill.storage-warning {
  background-color: var(--color-warning);
}

.storage-bar-fill.storage-danger {
  background-color: var(--color-error);
}

.quota-editor {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  margin-top: var(--space-1);
}

.quota-input {
  width: 80px;
  font-size: var(--text-sm);
  padding: var(--space-1) var(--space-2);
}

.quota-unit {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.quota-edit-btn {
  font-size: var(--text-xs);
  margin-top: var(--space-1);
}

/* Stats grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-4);
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  color: #fff;
}

.stat-icon-users { background-color: var(--color-primary-500); }
.stat-icon-files { background-color: var(--color-success, #22c55e); }
.stat-icon-storage { background-color: var(--color-warning, #f59e0b); }
.stat-icon-links { background-color: var(--color-info, #3b82f6); }

.stat-number {
  font-size: var(--text-2xl, 1.5rem);
  font-weight: 700;
  line-height: 1.2;
}

.stat-label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

/* Recent uploads */
.recent-uploads-list {
  display: flex;
  flex-direction: column;
}

.recent-upload-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-1);
  border-bottom: 1px solid var(--border-color);
  text-decoration: none;
  color: inherit;
  transition: background-color 0.15s ease;
}

.recent-upload-row:last-child {
  border-bottom: none;
}

.recent-upload-row:hover {
  background-color: var(--bg-secondary);
}

.recent-upload-info {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
  flex: 1;
}

.recent-upload-filename {
  font-size: var(--text-sm);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recent-upload-meta {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  flex-shrink: 0;
}

.recent-upload-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-shrink: 0;
}

.recent-upload-user {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.recent-upload-time {
  font-size: var(--text-xs);
  color: var(--text-tertiary, var(--text-secondary));
  min-width: 80px;
  text-align: right;
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

.modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: var(--space-4);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border-color);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

.empty-state { text-align: center; padding: var(--space-8); color: var(--text-secondary); }

.error-message {
  background-color: rgba(239, 68, 68, 0.1); color: var(--color-error);
  padding: var(--space-3); border-radius: var(--radius-md); font-size: var(--text-sm); margin-bottom: var(--space-4);
}
</style>
