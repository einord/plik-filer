<script setup lang="ts">
import { HugeiconsIcon } from '@hugeicons/vue'

const props = withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  icon?: object | null
  iconRight?: object | null
  iconOnly?: boolean
  block?: boolean
  disabled?: boolean
  loading?: boolean
  type?: 'button' | 'submit' | 'reset'
  to?: string
}>(), {
  variant: 'primary',
  size: 'md',
  icon: null,
  iconRight: null,
  iconOnly: false,
  block: false,
  disabled: false,
  loading: false,
  type: 'button',
})

const iconSize = computed(() => {
  if (props.size === 'sm') return 16
  if (props.size === 'lg') return 20
  return 18
})

const classes = computed(() => [
  'p-btn',
  `p-btn--${props.variant}`,
  `p-btn--${props.size}`,
  {
    'p-btn--icon-only': props.iconOnly,
    'p-btn--block': props.block,
    'p-btn--loading': props.loading,
  },
])
</script>

<template>
  <NuxtLink v-if="to" :to="to" :class="classes">
    <HugeiconsIcon v-if="icon" :icon="icon" :size="iconSize" class="p-btn__icon" />
    <span v-if="!iconOnly" class="p-btn__label"><slot /></span>
    <HugeiconsIcon v-if="iconRight" :icon="iconRight" :size="iconSize" class="p-btn__icon" />
  </NuxtLink>
  <button v-else :type="type" :class="classes" :disabled="disabled || loading" @click="$emit('click', $event)">
    <HugeiconsIcon v-if="icon && !loading" :icon="icon" :size="iconSize" class="p-btn__icon" />
    <span v-if="loading" class="p-btn__spinner" />
    <span v-if="!iconOnly" class="p-btn__label"><slot /></span>
    <HugeiconsIcon v-if="iconRight && !loading" :icon="iconRight" :size="iconSize" class="p-btn__icon" />
  </button>
</template>

<style scoped>
.p-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  font-family: inherit;
  font-weight: 500;
  line-height: 1;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
  user-select: none;
  text-decoration: none;
}

/* Sizes */
.p-btn--sm {
  font-size: var(--text-xs);
  padding: 6px 10px;
  min-height: 30px;
}

.p-btn--md {
  font-size: var(--text-sm);
  padding: 8px 14px;
  min-height: 36px;
}

.p-btn--lg {
  font-size: var(--text-base);
  padding: 10px 20px;
  min-height: 42px;
}

/* Icon-only */
.p-btn--icon-only {
  padding: 0;
  gap: 0;
}

.p-btn--icon-only.p-btn--sm {
  width: 30px;
  height: 30px;
}

.p-btn--icon-only.p-btn--md {
  width: 36px;
  height: 36px;
}

.p-btn--icon-only.p-btn--lg {
  width: 42px;
  height: 42px;
}

/* Block */
.p-btn--block {
  width: 100%;
}

/* Variants */
.p-btn--primary {
  background-color: var(--color-primary-600);
  color: white;
}

.p-btn--primary:hover:not(:disabled) {
  background-color: var(--color-primary-700);
}

.p-btn--secondary {
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
  border-color: var(--border-color);
}

.p-btn--secondary:hover:not(:disabled) {
  background-color: var(--border-color);
}

.p-btn--ghost {
  background-color: transparent;
  color: var(--text-secondary);
}

.p-btn--ghost:hover:not(:disabled) {
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
}

.p-btn--danger {
  background-color: transparent;
  color: var(--color-error);
}

.p-btn--danger:hover:not(:disabled) {
  background-color: rgba(239, 68, 68, 0.1);
}

/* Disabled */
.p-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Loading */
.p-btn--loading {
  pointer-events: none;
}

.p-btn__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: p-btn-spin 0.6s linear infinite;
}

@keyframes p-btn-spin {
  to { transform: rotate(360deg); }
}

/* Icon alignment */
.p-btn__icon {
  flex-shrink: 0;
}
</style>
