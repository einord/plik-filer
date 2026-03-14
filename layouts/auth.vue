<template>
  <div class="auth-layout">
    <div class="auth-container">
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

.auth-card {
  padding: var(--space-8);
}
</style>
