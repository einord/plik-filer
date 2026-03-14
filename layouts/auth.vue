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
      <div v-if="brandingLogo" class="auth-branding">
        <img :src="brandingLogo" :alt="brandingName || 'Logo'" class="auth-logo" />
      </div>
      <div class="auth-card card">
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
}

.auth-logo {
  height: 48px;
  width: auto;
  object-fit: contain;
}

.auth-card {
  padding: var(--space-8);
}
</style>
