<script setup lang="ts">
import { Delete02Icon, Download04Icon, Share08Icon } from '@hugeicons/core-free-icons'

withDefaults(defineProps<{
  count: number
  canShare?: boolean
  canWrite?: boolean
}>(), {
  canShare: false,
  canWrite: false,
})

defineEmits<{
  download: []
  share: []
  delete: []
  deselect: []
}>()
</script>

<template>
  <div class="selection-bar">
    <span>{{ $t('files.selected', { count }) }}</span>
    <PBtn size="sm" :icon="Download04Icon" @click="$emit('download')">
      {{ $t('files.downloadSelected') }}
    </PBtn>
    <PBtn v-if="canShare" size="sm" variant="secondary" :icon="Share08Icon" @click="$emit('share')">
      {{ $t('share.shareSelected') }}
    </PBtn>
    <PBtn variant="ghost" size="sm" @click="$emit('deselect')">
      {{ $t('files.deselectAll') }}
    </PBtn>
    <div class="spacer" />
    <PBtn v-if="canWrite" size="sm" variant="danger" :icon="Delete02Icon" @click="$emit('delete')">
      {{ $t('files.deleteSelected') }}
    </PBtn>
  </div>
</template>

<style scoped>
.selection-bar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background-color: var(--bg-tertiary);
  border-radius: var(--radius-md);
  margin-top: var(--space-3);
  font-size: var(--text-sm);
}

.spacer {
  flex: 1;
}
</style>
