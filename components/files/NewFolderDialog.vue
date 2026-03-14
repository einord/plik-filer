<script setup lang="ts">
const name = defineModel<string>({ required: true })

defineEmits<{
  submit: []
  cancel: []
}>()
</script>

<template>
  <div class="new-folder card">
    <form @submit.prevent="$emit('submit')" class="new-folder-form">
      <input
        v-model="name"
        :placeholder="$t('files.folderName')"
        autofocus
        @keydown.esc="$emit('cancel')"
      />
      <PBtn type="submit" size="sm">{{ $t('common.save') }}</PBtn>
      <PBtn type="button" variant="ghost" size="sm" @click="$emit('cancel')">{{ $t('common.cancel') }}</PBtn>
    </form>
  </div>
</template>

<style scoped>
.new-folder {
  padding: var(--space-3);
  margin-bottom: var(--space-4);
}

.new-folder-form {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.new-folder-form input {
  flex: 1;
  max-width: 300px;
}
</style>
