<script setup lang="ts">
const props = withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md'
  icon?: object | null
  align?: 'left' | 'right'
}>(), {
  variant: 'ghost',
  size: 'sm',
  icon: null,
  align: 'left',
})

const open = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

function toggle() {
  open.value = !open.value
}

function close() {
  open.value = false
}

function onClickOutside(event: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    close()
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
})
</script>

<template>
  <div ref="dropdownRef" class="p-dropdown">
    <PBtn
      :variant="variant"
      :size="size"
      :icon="icon"
      @click="toggle"
    >
      <slot name="trigger" />
    </PBtn>
    <Transition name="dropdown">
      <div v-if="open" class="p-dropdown-menu" :class="[`p-dropdown-${align}`]" @click="close">
        <slot />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.p-dropdown {
  position: relative;
  display: inline-flex;
}

.p-dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  z-index: 100;
  min-width: 180px;
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  padding: var(--space-1) 0;
  display: flex;
  flex-direction: column;
}

.p-dropdown-left {
  left: 0;
}

.p-dropdown-right {
  right: 0;
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
