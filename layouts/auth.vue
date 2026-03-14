<script setup lang="ts">
// Branding logo for login/setup pages
const brandingLogo = ref('')
const brandingName = ref('')

async function loadBranding() {
  try {
    const { branding } = await $fetch<{ branding: { serviceName: string; logoUrl: string; logoType: string } }>('/api/settings/branding')
    brandingName.value = branding.serviceName || ''
    if (branding.logoType === 'upload') {
      brandingLogo.value = `/api/settings/logo?t=${Date.now()}`
    } else if (branding.logoType === 'url' && branding.logoUrl) {
      brandingLogo.value = branding.logoUrl
    }
  } catch {}
}

onMounted(loadBranding)
</script>

<template>
  <div class="auth-layout">
    <div class="auth-container">
      <div class="auth-card card">
        <div class="auth-branding">
          <img v-if="brandingLogo" :src="brandingLogo" :alt="brandingName || 'Logo'" class="auth-logo" />
          <span class="auth-service-name">{{ brandingName || 'plik Filer' }}</span>
        </div>
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-layout {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-secondary);
  padding: var(--space-4);
}

.auth-container {
  width: 100%;
  max-width: 440px;
}

.auth-branding {
  text-align: center;
  margin-bottom: var(--space-6);
  padding-bottom: var(--space-6);
  border-bottom: 1px solid var(--border-color);
}

.auth-logo {
  height: 72px;
  max-width: 100%;
  object-fit: contain;
}

.auth-service-name {
  display: block;
  margin-top: var(--space-3);
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
}

.auth-card {
  padding: var(--space-8);
}
</style>
