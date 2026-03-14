<script setup lang="ts">
import { HugeiconsIcon } from '@hugeicons/vue'
import {
  Sun02Icon,
  Moon02Icon,
  ComputerIcon,
  File02Icon,
  Link04Icon,
  Settings02Icon,
  UserIcon,
  Logout02Icon,
} from '@hugeicons/core-free-icons'

const { t } = useI18n()
const { user, isAuthenticated, isAdmin, logout } = useAuth()
const colorMode = useColorMode()

const themeOptions = [
  { value: 'system', label: () => t('settings.themeAuto') },
  { value: 'light', label: () => t('settings.themeLight') },
  { value: 'dark', label: () => t('settings.themeDark') },
]

function cycleTheme() {
  const modes = ['system', 'light', 'dark']
  const current = modes.indexOf(colorMode.preference)
  colorMode.preference = modes[(current + 1) % modes.length]
}

const themeIconComponent = computed(() => {
  if (colorMode.preference === 'dark') return Moon02Icon
  if (colorMode.preference === 'light') return Sun02Icon
  return ComputerIcon
})
</script>

<template>
  <div class="app-layout">
    <header class="app-header" v-if="isAuthenticated">
      <div class="header-content">
        <NuxtLink to="/files" class="logo">
          {{ $t('common.appName') }}
        </NuxtLink>

        <nav class="nav-links">
          <NuxtLink to="/files" class="nav-link">
            <HugeiconsIcon :icon="File02Icon" :size="18" />
            {{ $t('files.files') }}
          </NuxtLink>
          <NuxtLink to="/files/shares" class="nav-link">
            <HugeiconsIcon :icon="Link04Icon" :size="18" />
            {{ $t('share.shareLinks') }}
          </NuxtLink>
          <NuxtLink v-if="isAdmin" to="/admin" class="nav-link">
            <HugeiconsIcon :icon="Settings02Icon" :size="18" />
            {{ $t('admin.dashboard') }}
          </NuxtLink>
        </nav>

        <div class="header-actions">
          <button class="btn btn-ghost btn-sm btn-icon" @click="cycleTheme" :title="$t('settings.theme')">
            <HugeiconsIcon :icon="themeIconComponent" :size="18" />
          </button>
          <NuxtLink to="/settings" class="btn btn-ghost btn-sm">
            <HugeiconsIcon :icon="UserIcon" :size="18" />
            {{ user?.name }}
          </NuxtLink>
          <button class="btn btn-ghost btn-sm btn-icon" @click="logout" :title="$t('auth.logout')">
            <HugeiconsIcon :icon="Logout02Icon" :size="18" />
          </button>
        </div>
      </div>
    </header>

    <main class="app-main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  background-color: var(--bg-elevated);
  border-bottom: 1px solid var(--border-color);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 var(--space-4);
  height: 56px;
  display: flex;
  align-items: center;
  gap: var(--space-6);
}

.logo {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--text-primary);
  text-decoration: none;
}

.nav-links {
  display: flex;
  gap: var(--space-1);
  flex: 1;
}

.nav-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-secondary);
  text-decoration: none;
  transition: all var(--transition-fast);
}

.nav-link:hover {
  color: var(--text-primary);
  background-color: var(--bg-tertiary);
}

.nav-link.router-link-active {
  color: var(--color-primary-600);
  background-color: var(--color-primary-50);
}

.dark .nav-link.router-link-active {
  color: var(--color-primary-400);
  background-color: rgba(59, 130, 246, 0.1);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.app-main {
  flex: 1;
  padding: var(--space-6) var(--space-4);
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}
</style>
