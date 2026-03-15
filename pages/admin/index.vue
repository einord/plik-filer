<script setup lang="ts">
import { HugeiconsIcon } from '@hugeicons/vue'
import { Delete02Icon, Settings02Icon, UserAdd01Icon, Folder01Icon, UserMultipleIcon, File02Icon, DatabaseIcon, Link04Icon, SentIcon, Copy01Icon } from '@hugeicons/core-free-icons'

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
const editingEmailUserId = ref<number | null>(null)
const editEmailValue = ref('')
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

function startEditEmail(user: any) {
  editingEmailUserId.value = user.id
  editEmailValue.value = user.email || ''
}

async function saveEmail(userId: number) {
  try {
    await $fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      body: { email: editEmailValue.value.trim() || null },
    })
    editingEmailUserId.value = null
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
    <div v-if="showCreateUser" class="card" style="margin-bottom: var(--space-4);">
      <h3 style="margin-bottom: var(--space-3);">{{ $t('admin.createUserDirect') }}</h3>
      <div class="form-group">
        <label>{{ $t('auth.name') }} *</label>
        <input v-model="newUserName" type="text" :placeholder="t('auth.name')" />
      </div>
      <div class="form-group">
        <label>{{ $t('auth.email') }} ({{ $t('common.optional') }})</label>
        <input v-model="newUserEmail" type="email" :placeholder="t('auth.email')" />
      </div>
      <div style="display: flex; gap: var(--space-2);">
        <PBtn size="sm" :disabled="createUserLoading || !newUserName.trim()" @click="createUserDirect">
          {{ createUserLoading ? $t('common.loading') : $t('admin.createUserDirect') }}
        </PBtn>
        <PBtn variant="ghost" size="sm" @click="showCreateUser = false">
          {{ $t('common.cancel') }}
        </PBtn>
      </div>
    </div>

    <!-- Setup link result -->
    <div v-if="setupLinkResult" class="card" style="margin-bottom: var(--space-4);">
      <p style="font-size: var(--text-sm); color: var(--color-success); margin-bottom: var(--space-2);">
        {{ setupLinkResult.emailSent ? $t('admin.setupLinkSent') : $t('admin.setupLinkGenerated') }}
      </p>
      <code style="font-size: var(--text-xs); word-break: break-all;">{{ setupLinkResult.url }}</code>
      <div style="display: flex; gap: var(--space-2); margin-top: var(--space-2);">
        <PBtn size="sm" :icon="Copy01Icon" @click="copyToClipboard(setupLinkResult.url)">
          {{ linkCopied ? $t('common.copied') : $t('share.copyLink') }}
        </PBtn>
        <PBtn variant="ghost" size="sm" @click="setupLinkResult = null">
          {{ $t('common.close') }}
        </PBtn>
      </div>
    </div>

    <!-- Users list -->
    <div class="card" v-if="!loading">
      <h2 style="font-size: var(--text-lg); font-weight: 600; margin-bottom: var(--space-4);">
        {{ $t('admin.userList') }} ({{ users.length }})
      </h2>

      <div v-if="users.length === 0" class="empty-state">
        {{ $t('admin.noUsers') }}
      </div>

      <div v-else class="users-list">
        <div v-for="u in users" :key="u.id" class="user-row">
          <div class="user-row-top">
            <div class="user-info">
              <div>
                <strong>{{ u.name }}</strong>
                <span class="badge" :class="u.role === 'admin' ? 'badge-info' : 'badge-success'" style="margin-left: var(--space-2);">
                  {{ u.role }}
                </span>
                <span v-if="!u.isActive" class="badge badge-error" style="margin-left: var(--space-1);">
                  {{ $t('share.inactive') }}
                </span>
                <span v-if="!u.setupCompleted && u.role !== 'admin'" class="badge badge-warning" style="margin-left: var(--space-1);">
                  {{ $t('admin.awaitingSetup') }}
                </span>
              </div>
              <div style="font-size: var(--text-sm); color: var(--text-secondary);">
                <template v-if="editingEmailUserId === u.id">
                  <div style="display: flex; align-items: center; gap: var(--space-1); margin-top: var(--space-1);">
                    <input v-model="editEmailValue" type="email" style="font-size: var(--text-sm); padding: 2px 6px; width: 200px;" :placeholder="t('auth.email')" @keydown.enter="saveEmail(u.id)" @keydown.esc="editingEmailUserId = null" />
                    <PBtn size="sm" @click="saveEmail(u.id)">{{ $t('common.save') }}</PBtn>
                    <PBtn variant="ghost" size="sm" @click="editingEmailUserId = null">{{ $t('common.cancel') }}</PBtn>
                  </div>
                </template>
                <template v-else>
                  {{ u.email || '—' }}
                  <PBtn v-if="!u.setupCompleted" variant="ghost" size="sm" style="margin-left: var(--space-1); font-size: var(--text-xs);" @click="startEditEmail(u)">
                    {{ $t('common.edit') }}
                  </PBtn>
                </template>
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
            <div class="user-permissions">
              <label class="permission-toggle">
                <input type="checkbox" :checked="u.canRead" @change="updatePermissions(u.id, 'canRead', !u.canRead)" />
                <span>{{ $t('admin.canRead') }}</span>
              </label>
              <label class="permission-toggle">
                <input type="checkbox" :checked="u.canWrite" @change="updatePermissions(u.id, 'canWrite', !u.canWrite)" />
                <span>{{ $t('admin.canWrite') }}</span>
              </label>
            </div>

            <div class="user-actions">
              <PBtn v-if="!u.setupCompleted" variant="ghost" size="sm" :icon="Copy01Icon" @click="copySetupLink(u.id)" :title="$t('admin.copySetupLink')">
                {{ $t('admin.copySetupLink') }}
              </PBtn>
              <PBtn v-if="!u.setupCompleted && u.email" variant="ghost" size="sm" :icon="SentIcon" @click="sendSetupLink(u.id)" :title="$t('admin.sendSetupLink')">
                {{ $t('admin.sendSetupLink') }}
              </PBtn>
              <PBtn v-if="!u.setupCompleted && u.hasSetupToken" variant="ghost" size="sm" @click="removeSetupLink(u.id)">
                {{ $t('admin.removeSetupLink') }}
              </PBtn>
              <PBtn variant="ghost" size="sm" :icon="Folder01Icon" :to="`/admin/users/${u.id}/files`" :title="$t('admin.manageFiles')">
                {{ $t('admin.manageFiles') }}
              </PBtn>
              <PBtn
                variant="ghost"
                size="sm"
                @click="toggleUser(u.id, u.isActive)"
              >
                {{ u.isActive ? $t('admin.deactivateUser') : $t('admin.activateUser') }}
              </PBtn>
              <PBtn variant="ghost" size="sm" :icon="Delete02Icon" icon-only @click="deleteUser(u.id)" :title="$t('common.delete')" />
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

.user-permissions {
  display: flex;
  gap: var(--space-4);
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

.empty-state { text-align: center; padding: var(--space-8); color: var(--text-secondary); }

.error-message {
  background-color: rgba(239, 68, 68, 0.1); color: var(--color-error);
  padding: var(--space-3); border-radius: var(--radius-md); font-size: var(--text-sm); margin-bottom: var(--space-4);
}
</style>
