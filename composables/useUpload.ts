import type { Upload as TusUploadType } from 'tus-js-client'
import type { UploadProgress } from '~/types'

const MAX_CONCURRENT_UPLOADS = 3
const SPEED_SAMPLE_WINDOW_MS = 5000

interface SpeedSample {
  timestamp: number
  loaded: number
}

interface TusUploadEntry {
  tusUpload: TusUploadType
  speedSamples: SpeedSample[]
}

export function useUpload() {
  const uploads = ref<Map<string, UploadProgress>>(new Map())
  const tusUploads = new Map<string, TusUploadEntry>()
  const pendingQueue: { file: File; parentId?: number | null; id: string; extraMetadata?: Record<string, string> }[] = []
  let activeCount = 0

  const isUploading = computed(() => {
    return Array.from(uploads.value.values()).some(
      (u) => u.status === 'uploading' || u.status === 'pending'
    )
  })

  /**
   * Calculates rolling average speed from recent samples within the time window.
   */
  function calculateRollingSpeed(samples: SpeedSample[]): number {
    const now = Date.now()
    const cutoff = now - SPEED_SAMPLE_WINDOW_MS

    // Remove old samples outside the window
    while (samples.length > 0 && samples[0].timestamp < cutoff) {
      samples.shift()
    }

    if (samples.length < 2) return 0

    const oldest = samples[0]
    const newest = samples[samples.length - 1]
    const elapsed = (newest.timestamp - oldest.timestamp) / 1000

    if (elapsed <= 0) return 0

    return (newest.loaded - oldest.loaded) / elapsed
  }

  /**
   * Formats a time duration in seconds to a human-readable string.
   */
  function formatTime(seconds: number): string {
    if (!isFinite(seconds) || seconds <= 0) return ''

    if (seconds < 60) return '< 1 min'

    const hours = Math.floor(seconds / 3600)
    const minutes = Math.ceil((seconds % 3600) / 60)

    if (hours > 0) {
      return `ca ${hours} h ${minutes} min`
    }

    return `ca ${minutes} min`
  }

  /**
   * Formats bytes per second to a human-readable speed string.
   */
  function formatSpeed(bytesPerSecond: number): string {
    if (bytesPerSecond <= 0) return '0 B/s'
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s']
    const i = Math.floor(Math.log(bytesPerSecond) / Math.log(1024))
    return `${(bytesPerSecond / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
  }

  /**
   * Starts the next queued upload if concurrency limit allows.
   */
  function processQueue() {
    while (activeCount < MAX_CONCURRENT_UPLOADS && pendingQueue.length > 0) {
      const next = pendingQueue.shift()!
      startTusUpload(next.file, next.parentId, next.id, next.extraMetadata)
    }
  }

  /**
   * Initiates a tus upload for a single file.
   */
  async function startTusUpload(file: File, parentId?: number | null, id?: string, extraMetadata?: Record<string, string>) {
    const { Upload: TusUpload } = await import('tus-js-client')
    const uploadId = id || `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

    activeCount++

    const metadata: Record<string, string> = {
      filename: file.name,
      filetype: file.type || 'application/octet-stream',
      ...extraMetadata,
    }
    if (parentId != null) {
      metadata.parentId = String(parentId)
    }

    const speedSamples: SpeedSample[] = []

    const tusUpload = new TusUpload(file, {
      endpoint: '/api/tus/',
      retryDelays: [0, 1000, 3000, 5000, 10000],
      chunkSize: 50 * 1024 * 1024, // 50 MB chunks
      metadata,
      withCredentials: true,
      removeFingerprintOnSuccess: true,

      onError(error) {
        const progress = uploads.value.get(uploadId)
        if (progress) {
          progress.status = 'error'
          progress.error = error.message || 'Upload failed'
          // Trigger reactivity
          uploads.value = new Map(uploads.value)
        }
        activeCount--
        tusUploads.delete(uploadId)
        processQueue()
      },

      onProgress(loaded, total) {
        const now = Date.now()
        speedSamples.push({ timestamp: now, loaded })

        const speed = calculateRollingSpeed(speedSamples)
        const remaining = total - loaded
        const timeRemaining = speed > 0 ? remaining / speed : 0

        const progress = uploads.value.get(uploadId)
        if (progress) {
          progress.status = 'uploading'
          progress.loaded = loaded
          progress.total = total
          progress.percentage = Math.round((loaded / total) * 100)
          progress.speed = speed
          progress.timeRemaining = timeRemaining
          // Trigger reactivity
          uploads.value = new Map(uploads.value)
        }
      },

      onSuccess() {
        const progress = uploads.value.get(uploadId)
        if (progress) {
          progress.status = 'complete'
          progress.percentage = 100
          progress.speed = 0
          progress.timeRemaining = 0
          // Trigger reactivity
          uploads.value = new Map(uploads.value)
        }
        activeCount--
        tusUploads.delete(uploadId)
        processQueue()

        // Check if all uploads are done
        checkAllComplete()
      },
    })

    tusUploads.set(uploadId, { tusUpload, speedSamples })

    // Find any previous uploads for this file to allow resuming
    tusUpload.findPreviousUploads().then((previousUploads) => {
      if (previousUploads.length > 0) {
        tusUpload.resumeFromPreviousUpload(previousUploads[0])
      }
      tusUpload.start()
    })
  }

  /**
   * Callback to notify when all uploads have completed.
   * Set by calling code via onAllComplete.
   */
  let allCompleteCallback: (() => void) | null = null

  /**
   * Checks if all uploads are done (complete or error) and fires the callback.
   */
  function checkAllComplete() {
    const allDone = Array.from(uploads.value.values()).every(
      (u) => u.status === 'complete' || u.status === 'error'
    )
    if (allDone && allCompleteCallback) {
      allCompleteCallback()
    }
  }

  /**
   * Registers a callback to be called when all uploads finish.
   */
  function onAllComplete(callback: () => void) {
    allCompleteCallback = callback
  }

  /**
   * Uploads files using the tus resumable upload protocol.
   * Supports concurrent uploads with pause/resume/cancel per file.
   */
  async function uploadFiles(fileList: File[], parentId?: number | null, extraMetadata?: Record<string, string>) {
    for (const file of fileList) {
      const id = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

      // Create progress entry
      uploads.value.set(id, {
        fileId: id,
        filename: file.name,
        loaded: 0,
        total: file.size,
        percentage: 0,
        speed: 0,
        timeRemaining: 0,
        status: 'pending',
      })

      if (activeCount < MAX_CONCURRENT_UPLOADS) {
        startTusUpload(file, parentId, id, extraMetadata)
      } else {
        pendingQueue.push({ file, parentId, id, extraMetadata })
      }
    }

    // Trigger reactivity
    uploads.value = new Map(uploads.value)
  }

  /**
   * Pauses a specific upload by its ID.
   */
  function pauseUpload(uploadId: string) {
    const entry = tusUploads.get(uploadId)
    if (entry) {
      entry.tusUpload.abort()
      const progress = uploads.value.get(uploadId)
      if (progress) {
        progress.status = 'paused'
        uploads.value = new Map(uploads.value)
      }
      activeCount--
      processQueue()
    }
  }

  /**
   * Resumes a paused upload by its ID.
   */
  function resumeUpload(uploadId: string) {
    const entry = tusUploads.get(uploadId)
    if (entry) {
      const progress = uploads.value.get(uploadId)
      if (progress) {
        progress.status = 'uploading'
        uploads.value = new Map(uploads.value)
      }
      activeCount++
      entry.speedSamples.length = 0 // Reset speed samples
      entry.tusUpload.start()
    }
  }

  /**
   * Cancels and removes a specific upload by its ID.
   */
  function cancelUpload(uploadId: string) {
    const entry = tusUploads.get(uploadId)
    if (entry) {
      entry.tusUpload.abort(true) // true = delete from server
      const progress = uploads.value.get(uploadId)
      if (progress && (progress.status === 'uploading' || progress.status === 'paused')) {
        activeCount--
      }
      tusUploads.delete(uploadId)
    }

    // Also remove from pending queue
    const queueIndex = pendingQueue.findIndex((q) => q.id === uploadId)
    if (queueIndex >= 0) {
      pendingQueue.splice(queueIndex, 1)
    }

    uploads.value.delete(uploadId)
    uploads.value = new Map(uploads.value)

    processQueue()
    checkAllComplete()
  }

  /**
   * Clears all completed and errored uploads from the list.
   */
  function clearUploads() {
    for (const [id, upload] of uploads.value) {
      if (upload.status === 'complete' || upload.status === 'error') {
        uploads.value.delete(id)
      }
    }
    uploads.value = new Map(uploads.value)
  }

  /**
   * Clears all uploads (including active ones — they are aborted first).
   */
  function clearAllUploads() {
    for (const [id, entry] of tusUploads) {
      entry.tusUpload.abort(true)
    }
    tusUploads.clear()
    pendingQueue.length = 0
    activeCount = 0
    uploads.value = new Map()
  }

  /**
   * Fallback upload method using XMLHttpRequest for simple/small files.
   * Kept for backward compatibility.
   */
  async function uploadFilesSimple(fileList: File[], parentId?: number | null) {
    const formData = new FormData()

    if (parentId) {
      formData.append('parentId', String(parentId))
    }

    for (const file of fileList) {
      const id = `${file.name}-${Date.now()}`
      uploads.value.set(id, {
        fileId: id,
        filename: file.name,
        loaded: 0,
        total: file.size,
        percentage: 0,
        speed: 0,
        timeRemaining: 0,
        status: 'pending',
      })
      formData.append('files', file)
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const startTime = Date.now()
      let lastLoaded = 0
      let lastTime = startTime

      xhr.upload.addEventListener('progress', (e) => {
        if (!e.lengthComputable) return

        const now = Date.now()
        const elapsed = (now - lastTime) / 1000
        const bytesPerSecond = elapsed > 0 ? (e.loaded - lastLoaded) / elapsed : 0
        const remaining = bytesPerSecond > 0 ? (e.total - e.loaded) / bytesPerSecond : 0

        for (const [id, upload] of uploads.value) {
          if (upload.status === 'pending' || upload.status === 'uploading') {
            upload.status = 'uploading'
            upload.loaded = Math.round((e.loaded / e.total) * upload.total)
            upload.percentage = Math.round((e.loaded / e.total) * 100)
            upload.speed = bytesPerSecond
            upload.timeRemaining = remaining
          }
        }

        lastLoaded = e.loaded
        lastTime = now
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          for (const [id, upload] of uploads.value) {
            upload.status = 'complete'
            upload.percentage = 100
          }
          try {
            resolve(JSON.parse(xhr.responseText))
          } catch {
            resolve({ success: true })
          }
        } else {
          for (const [id, upload] of uploads.value) {
            upload.status = 'error'
            try {
              const response = JSON.parse(xhr.responseText)
              upload.error = response.statusMessage || response.message || 'Upload failed'
            } catch {
              upload.error = 'Upload failed'
            }
          }
          reject(new Error('Upload failed'))
        }
      })

      xhr.addEventListener('error', () => {
        for (const [id, upload] of uploads.value) {
          upload.status = 'error'
          upload.error = 'Network error'
        }
        reject(new Error('Network error'))
      })

      xhr.open('POST', '/api/files/upload')
      xhr.send(formData)
    })
  }

  return {
    uploads,
    isUploading,
    uploadFiles,
    uploadFilesSimple,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    clearUploads,
    clearAllUploads,
    onAllComplete,
    formatSpeed,
    formatTime,
  }
}
