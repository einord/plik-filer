import { writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs'
import { join, extname } from 'path'

const ALLOWED_EXTENSIONS = new Set(['.png', '.svg', '.jpg', '.jpeg', '.webp'])
const MAX_SIZE = 2 * 1024 * 1024 // 2 MB

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const formData = await readMultipartFormData(event)
  if (!formData) {
    throw createError({ statusCode: 400, statusMessage: 'No file uploaded' })
  }

  const file = formData.find((f) => f.name === 'logo' && f.filename)
  if (!file) {
    throw createError({ statusCode: 400, statusMessage: 'No logo file found in upload' })
  }

  // Validate file extension
  const ext = extname(file.filename!).toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid file type. Allowed: PNG, SVG, JPG, WEBP' })
  }

  // Validate file size
  if (file.data.length > MAX_SIZE) {
    throw createError({ statusCode: 413, statusMessage: 'File too large. Maximum size is 2 MB.' })
  }

  const dataPath = getDataPath()
  const brandingDir = join(dataPath, '.branding')

  // Create branding directory if it doesn't exist
  if (!existsSync(brandingDir)) {
    mkdirSync(brandingDir, { recursive: true })
  }

  // Remove any existing logo files
  if (existsSync(brandingDir)) {
    const existing = readdirSync(brandingDir).filter((f) => f.startsWith('logo.'))
    for (const f of existing) {
      unlinkSync(join(brandingDir, f))
    }
  }

  // Save the new logo file
  const logoFilename = `logo${ext}`
  const logoPath = join(brandingDir, logoFilename)
  writeFileSync(logoPath, file.data)

  return { success: true, url: '/api/settings/logo' }
})
