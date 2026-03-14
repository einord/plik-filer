import { existsSync, mkdirSync, statSync, unlinkSync, rmSync, readdirSync } from 'fs'
import { join, extname } from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const THUMBNAIL_SIZE = 300
const THUMBNAIL_DIR = '.thumbnails'

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.bmp', '.tiff', '.tif'])
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm', '.m4v', '.mpg', '.mpeg', '.3gp'])

export function getDataPath(): string {
  return process.env.NUXT_DATA_PATH || useRuntimeConfig().dataPath || './data'
}

export function getUserDir(userId: number): string {
  const dir = join(getDataPath(), String(userId))
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

export function getUserThumbnailDir(userId: number): string {
  const dir = join(getUserDir(userId), THUMBNAIL_DIR)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

export function isImageFile(filename: string): boolean {
  return IMAGE_EXTENSIONS.has(extname(filename).toLowerCase())
}

export function isVideoFile(filename: string): boolean {
  return VIDEO_EXTENSIONS.has(extname(filename).toLowerCase())
}

export async function generateThumbnail(userId: number, filePath: string, filename: string): Promise<string | null> {
  const ext = extname(filename).toLowerCase()
  const thumbnailDir = getUserThumbnailDir(userId)
  const thumbnailName = `${Date.now()}_${filename.replace(/\.[^.]+$/, '.jpg')}`
  const thumbnailPath = join(thumbnailDir, thumbnailName)

  try {
    if (isImageFile(filename)) {
      // Use sharp for image thumbnails
      const sharp = await import('sharp')
      await sharp.default(filePath)
        .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath)
      return thumbnailPath
    }

    if (isVideoFile(filename)) {
      // Use ffmpeg to extract a frame
      await execFileAsync('ffmpeg', [
        '-i', filePath,
        '-ss', '00:00:01',
        '-vframes', '1',
        '-vf', `scale=${THUMBNAIL_SIZE}:${THUMBNAIL_SIZE}:force_original_aspect_ratio=decrease`,
        '-y',
        thumbnailPath,
      ], { timeout: 30000 })

      if (existsSync(thumbnailPath)) {
        return thumbnailPath
      }
    }
  } catch (error) {
    console.error(`Failed to generate thumbnail for ${filename}:`, error)
  }

  return null
}

export function deleteFile(filePath: string) {
  if (existsSync(filePath)) {
    unlinkSync(filePath)
  }
}

export function deleteDirectory(dirPath: string) {
  if (existsSync(dirPath)) {
    rmSync(dirPath, { recursive: true, force: true })
  }
}

export function getDirSize(dirPath: string): number {
  let totalSize = 0

  if (!existsSync(dirPath)) return 0

  const entries = readdirSync(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name === THUMBNAIL_DIR) continue
    const fullPath = join(dirPath, entry.name)
    if (entry.isDirectory()) {
      totalSize += getDirSize(fullPath)
    } else {
      totalSize += statSync(fullPath).size
    }
  }

  return totalSize
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

export function sanitizeFilename(filename: string): string {
  // Remove path traversal attempts and invalid characters
  return filename
    .replace(/\.\./g, '')
    .replace(/[\/\\:*?"<>|]/g, '_')
    .trim()
}

export function getMimeType(filename: string): string {
  const ext = extname(filename).toLowerCase()
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.bmp': 'image/bmp',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    '.wmv': 'video/x-ms-wmv',
    '.flv': 'video/x-flv',
    '.webm': 'video/webm',
    '.m4v': 'video/x-m4v',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.flac': 'audio/flac',
    '.aac': 'audio/aac',
    '.ogg': 'audio/ogg',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.7z': 'application/x-7z-compressed',
    '.psd': 'image/vnd.adobe.photoshop',
    '.ai': 'application/postscript',
    '.eps': 'application/postscript',
    '.indd': 'application/x-indesign',
    '.prproj': 'application/octet-stream',
    '.aep': 'application/octet-stream',
    '.fcpxml': 'application/xml',
    '.drp': 'application/octet-stream',
  }
  return mimeTypes[ext] || 'application/octet-stream'
}
