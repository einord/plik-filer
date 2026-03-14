<script setup lang="ts">
import { HugeiconsIcon } from '@hugeicons/vue'
import { Cancel01Icon } from '@hugeicons/core-free-icons'

defineEmits<{
  close: []
}>()

function onOverlayClick(event: MouseEvent) {
  if (event.target === event.currentTarget) {
    // Only close when clicking the overlay itself, not the content
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="$emit('close')" @keydown.esc="$emit('close')">
      <div class="modal-container">
        <PBtn
          variant="ghost"
          size="sm"
          :icon="Cancel01Icon"
          icon-only
          class="modal-close"
          @click="$emit('close')"
          :title="$t('common.close')"
        />
        <slot />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.7);
  padding: var(--space-4);
}

.modal-container {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-primary);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
}

.modal-close {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  z-index: 10;
}
</style>
