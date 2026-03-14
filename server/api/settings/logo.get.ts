import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

export default defineEventHandler(async (event) => {
  const dataPath = getDataPath()
  const brandingDir = join(dataPath, '.branding')

  if (!existsSync(brandingDir)) {
    throw createError({ statusCode: 404, statusMessage: 'No logo found' })
  }

  // Find the logo file
  const logoFiles = readdirSync(brandingDir).filter((f) => f.startsWith('logo.'))
  if (logoFiles.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'No logo found' })
  }

  const logoFilename = logoFiles[0]
  const logoPath = join(brandingDir, logoFilename)
  const mimeType = getMimeType(logoFilename)

  const stat = statSync(logoPath)
  const fileData = readFileSync(logoPath)

  setResponseHeaders(event, {
    'Content-Type': mimeType,
    'Content-Length': stat.size.toString(),
    'Cache-Control': 'public, max-age=3600',
  })

  return fileData
})
