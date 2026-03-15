<script setup lang="ts">
import type { FileItem } from '~/types'
import { HugeiconsIcon } from '@hugeicons/vue'
import { File02Icon } from '@hugeicons/core-free-icons'

const props = withDefaults(defineProps<{
  file: FileItem
  downloadBaseUrl?: string
  downloadUrlSuffix?: string
}>(), {
  downloadBaseUrl: '/api/files/download',
  downloadUrlSuffix: '',
})

defineEmits<{
  close: []
}>()

const textContent = ref<string | null>(null)
const textLoading = ref(false)
const textError = ref(false)

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.bmp', '.svg'])
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.m4v', '.ogv'])
const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.markdown', '.json', '.js', '.ts', '.jsx', '.tsx',
  '.css', '.scss', '.less', '.html', '.htm', '.xml', '.svg',
  '.yml', '.yaml', '.toml', '.ini', '.cfg', '.conf',
  '.sh', '.bash', '.zsh', '.fish',
  '.py', '.rb', '.php', '.java', '.go', '.rs', '.c', '.cpp', '.h',
  '.sql', '.graphql', '.gql',
  '.env', '.gitignore', '.dockerignore', '.editorconfig',
  '.csv', '.tsv', '.log',
  '.vue', '.svelte', '.astro',
])

const fileExtension = computed(() => {
  const name = props.file.filename.toLowerCase()
  const dotIndex = name.lastIndexOf('.')
  return dotIndex >= 0 ? name.substring(dotIndex) : ''
})

const previewType = computed<'image' | 'video' | 'text' | 'unknown'>(() => {
  if (IMAGE_EXTENSIONS.has(fileExtension.value)) return 'image'
  if (VIDEO_EXTENSIONS.has(fileExtension.value)) return 'video'
  if (TEXT_EXTENSIONS.has(fileExtension.value)) return 'text'
  return 'unknown'
})

const fileUrl = computed(() => `${props.downloadBaseUrl}/${props.file.id}${props.downloadUrlSuffix}`)

async function loadTextContent() {
  textLoading.value = true
  textError.value = false
  try {
    const response = await fetch(fileUrl.value)
    if (!response.ok) throw new Error('Failed to fetch')
    const text = await response.text()
    // Limit preview to 500KB of text
    textContent.value = text.length > 512_000 ? text.substring(0, 512_000) + '\n\n... (truncated)' : text
  } catch {
    textError.value = true
  } finally {
    textLoading.value = false
  }
}

onMounted(() => {
  if (previewType.value === 'text') {
    loadTextContent()
  }
})
</script>

<template>
  <PModal @close="$emit('close')">
    <div class="preview-content">
      <div class="preview-header">
        <span class="preview-filename truncate">{{ file.filename }}</span>
      </div>

      <!-- Image preview -->
      <div v-if="previewType === 'image'" class="preview-body preview-image">
        <img :src="fileUrl" :alt="file.filename" />
      </div>

      <!-- Video preview -->
      <div v-else-if="previewType === 'video'" class="preview-body preview-video">
        <video controls :src="fileUrl" :type="file.mimeType || undefined">
          {{ $t('files.previewNotSupported') }}
        </video>
      </div>

      <!-- Text preview -->
      <div v-else-if="previewType === 'text'" class="preview-body preview-text">
        <div v-if="textLoading" class="preview-placeholder">
          {{ $t('common.loading') }}
        </div>
        <div v-else-if="textError" class="preview-placeholder">
          {{ $t('files.previewError') }}
        </div>
        <pre v-else class="preview-code">{{ textContent }}</pre>
      </div>

      <!-- Unknown type -->
      <div v-else class="preview-body preview-unknown">
        <div class="preview-placeholder">
          <HugeiconsIcon :icon="File02Icon" :size="48" />
          <p>{{ $t('files.previewNotSupported') }}</p>
        </div>
      </div>
    </div>
  </PModal>
</template>

<style scoped>
.preview-content {
  display: flex;
  flex-direction: column;
  max-width: 90vw;
  max-height: 90vh;
}

.preview-header {
  display: flex;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  padding-right: var(--space-10, 48px);
  border-bottom: 1px solid var(--border-color);
  font-weight: 500;
  font-size: var(--text-sm);
}

.preview-filename {
  max-width: 500px;
}

.preview-body {
  overflow: auto;
  min-width: 300px;
  min-height: 200px;
}

.preview-image {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background-color: var(--bg-secondary);
}

.preview-image img {
  max-width: 80vw;
  max-height: 75vh;
  object-fit: contain;
  border-radius: var(--radius-sm);
}

.preview-video {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background-color: #000;
}

.preview-video video {
  max-width: 80vw;
  max-height: 75vh;
}

.preview-text {
  padding: 0;
}

.preview-code {
  margin: 0;
  padding: var(--space-4);
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: var(--text-xs);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 75vh;
  overflow: auto;
  background-color: var(--bg-secondary);
  color: var(--text-primary);
}

.preview-unknown {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
}

.preview-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  color: var(--text-tertiary);
  padding: var(--space-8);
  text-align: center;
}
</style>
