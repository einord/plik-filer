<script setup lang="ts">
import { HugeiconsIcon } from '@hugeicons/vue'
import { Delete02Icon, Settings02Icon, UserAdd01Icon } from '@hugeicons/core-free-icons'

const { t } = useI18n()

const users = ref<any[]>([])
const invitations = ref<any[]>([])
const loading = ref(true)
const error = ref('')
const showInvite = ref(false)
const inviteEmail = ref('')
const inviteResult = ref<{ url: string } | null>(null)
const userStats = ref<Record<number, { totalFiles: number; totalUsed: number; maxFileSize: number }>>({})
const editingQuotaUserId = ref<number | null>(null)
const editQuotaValueGB = ref(100)

async function loadData() {
  loading.value = true
  try {
    const [usersData, invData] = await Promise.all([
      $fetch('/api/users'),
      $fetch('/api/users/invitations'),
    ])
    users.value = usersData.users
    invitations.value = invData.invitations

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

async function createInvitation() {
  try {
    const data = await $fetch('/api/users/invite', {
      method: 'POST',
      body: { email: inviteEmail.value || undefined },
    })
    inviteResult.value = { url: data.invitation.url }
    if (data.invitation.url) {
      await navigator.clipboard.writeText(data.invitation.url)
    }
    inviteEmail.value = ''
    await loadData()
  } catch (e: any) {
    error.value = e.data?.statusMessage || t('errors.serverError')
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
        <NuxtLink to="/admin/settings" class="btn btn-secondary btn-sm">
          <HugeiconsIcon :icon="Settings02Icon" :size="18" />
          {{ $t('admin.settings') }}
        </NuxtLink>
        <button class="btn btn-primary btn-sm" @click="showInvite = true">
          <HugeiconsIcon :icon="UserAdd01Icon" :size="18" />
          {{ $t('admin.createInvitation') }}
        </button>
      </div>
    </div>

    <div v-if="error" class="error-message">{{ error }}</div>

    <!-- Invite dialog -->
    <div v-if="showInvite" class="card" style="margin-bottom: var(--space-4);">
      <h3 style="margin-bottom: var(--space-3);">{{ $t('admin.createInvitation') }}</h3>
      <div class="form-group">
        <label>{{ $t('auth.email') }} ({{ $t('common.optional') }})</label>
        <input v-model="inviteEmail" type="email" :placeholder="t('auth.email')" />
      </div>
      <div style="display: flex; gap: var(--space-2);">
        <button class="btn btn-primary btn-sm" @click="createInvitation">
          {{ $t('admin.createInvitation') }}
        </button>
        <button class="btn btn-ghost btn-sm" @click="showInvite = false; inviteResult = null">
          {{ $t('common.cancel') }}
        </button>
      </div>

      <div v-if="inviteResult" style="margin-top: var(--space-3); padding: var(--space-3); background: var(--bg-secondary); border-radius: var(--radius-md);">
        <p style="font-size: var(--text-sm); color: var(--color-success); margin-bottom: var(--space-2);">
          {{ $t('admin.invitationCreated') }}
        </p>
        <code style="font-size: var(--text-xs); word-break: break-all;">{{ inviteResult.url }}</code>
        <p style="font-size: var(--text-xs); color: var(--text-secondary); margin-top: var(--space-1);">
          {{ $t('common.copied') }}
        </p>
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
          <div class="user-info">
            <div>
              <strong>{{ u.name }}</strong>
              <span class="badge" :class="u.role === 'admin' ? 'badge-info' : 'badge-success'" style="margin-left: var(--space-2);">
                {{ u.role }}
              </span>
              <span v-if="!u.isActive" class="badge badge-error" style="margin-left: var(--space-1);">
                {{ $t('share.inactive') }}
              </span>
            </div>
            <div style="font-size: var(--text-sm); color: var(--text-secondary);">
              {{ u.email }}
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
              <button class="btn btn-primary btn-sm" @click="saveQuota(u.id)">{{ $t('common.save') }}</button>
              <button class="btn btn-ghost btn-sm" @click="editingQuotaUserId = null">{{ $t('common.cancel') }}</button>
            </div>
            <button v-else class="btn btn-ghost btn-sm quota-edit-btn" @click="startEditQuota(u)">
              {{ $t('admin.editQuota') }}
            </button>
          </div>

          <div class="user-permissions" v-if="u.role !== 'admin'">
            <label class="permission-toggle">
              <input type="checkbox" :checked="u.canRead" @change="updatePermissions(u.id, 'canRead', !u.canRead)" />
              <span>{{ $t('admin.canRead') }}</span>
            </label>
            <label class="permission-toggle">
              <input type="checkbox" :checked="u.canWrite" @change="updatePermissions(u.id, 'canWrite', !u.canWrite)" />
              <span>{{ $t('admin.canWrite') }}</span>
            </label>
          </div>

          <div class="user-actions" v-if="u.role !== 'admin'">
            <button
              class="btn btn-ghost btn-sm"
              @click="toggleUser(u.id, u.isActive)"
            >
              {{ u.isActive ? $t('admin.deactivateUser') : $t('admin.activateUser') }}
            </button>
            <button class="btn btn-ghost btn-sm btn-icon" @click="deleteUser(u.id)" :title="$t('common.delete')">
              <HugeiconsIcon :icon="Delete02Icon" :size="18" />
            </button>
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
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--border-color);
  gap: var(--space-4);
  flex-wrap: wrap;
}

.user-row:last-child { border-bottom: none; }

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
}

.user-actions {
  display: flex;
  gap: var(--space-1);
}

.user-storage {
  flex: 0 0 auto;
  min-width: 200px;
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
  padding: 0;
}

.empty-state { text-align: center; padding: var(--space-8); color: var(--text-secondary); }

.error-message {
  background-color: rgba(239, 68, 68, 0.1); color: var(--color-error);
  padding: var(--space-3); border-radius: var(--radius-md); font-size: var(--text-sm); margin-bottom: var(--space-4);
}
</style>
