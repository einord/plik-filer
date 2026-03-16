<script setup lang="ts">
const { t } = useI18n()

const props = defineProps<{
  totalUsed: number
  maxAllowed: number
}>()

const percentage = computed(() =>
  props.maxAllowed > 0 ? (props.totalUsed / props.maxAllowed) * 100 : 0
)

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}
</script>

<template>
  <div
    class="storage-indicator"
    :class="{
      'storage-warn': percentage >= 90 && percentage < 95,
      'storage-error': percentage >= 95,
    }"
  >
    <div class="storage-info">
      <span class="storage-text">{{ $t('files.storageUsed', { used: formatSize(totalUsed), total: formatSize(maxAllowed) }) }}</span>
      <span v-if="percentage >= 90" class="storage-warning-text">{{ $t('files.storageAlmostFull') }}</span>
    </div>
    <div class="storage-progress-bar">
      <div
        class="storage-progress-fill"
        :class="{ 'fill-warn': percentage >= 90 && percentage < 95, 'fill-error': percentage >= 95 }"
        :style="{ width: `${Math.min(percentage, 100)}%` }"
      />
    </div>
  </div>
</template>

<style scoped>
.storage-indicator {
  margin-bottom: var(--space-4);
  padding: var(--space-2) var(--space-3);
  background-color: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.storage-indicator.storage-warn {
  background-color: rgba(245, 158, 11, 0.08);
}

.storage-indicator.storage-error {
  background-color: rgba(239, 68, 68, 0.08);
}

.storage-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-1);
}

.storage-text {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.storage-warning-text {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--color-warning);
}

.storage-error .storage-warning-text {
  color: var(--color-error);
}

.storage-progress-bar {
  height: 4px;
  background-color: var(--bg-tertiary);
  border-radius: 2px;
  overflow: hidden;
}

.storage-progress-fill {
  height: 100%;
  background-color: var(--color-primary-500);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.storage-progress-fill.fill-warn {
  background-color: var(--color-warning);
}

.storage-progress-fill.fill-error {
  background-color: var(--color-error);
}
</style>
