<script setup lang="ts">
import { HugeiconsIcon } from '@hugeicons/vue'

withDefaults(defineProps<{
  icon?: object | null
  danger?: boolean
}>(), {
  icon: null,
  danger: false,
})

defineEmits<{
  click: []
}>()
</script>

<template>
  <button class="p-dropdown-item" :class="{ 'p-dropdown-item--danger': danger }" @click="$emit('click')">
    <HugeiconsIcon v-if="icon" :icon="icon" :size="16" class="p-dropdown-item-icon" />
    <span><slot /></span>
  </button>
</template>

<style scoped>
.p-dropdown-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: none;
  background: none;
  font-size: var(--text-sm);
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
  white-space: nowrap;
  transition: background-color var(--transition-fast);
}

.p-dropdown-item:hover {
  background-color: var(--bg-secondary);
}

.p-dropdown-item--danger {
  color: var(--color-error);
}

.p-dropdown-item--danger:hover {
  background-color: rgba(239, 68, 68, 0.08);
}

.p-dropdown-item-icon {
  flex-shrink: 0;
}
</style>
