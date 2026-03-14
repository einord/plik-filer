import { existsSync, readdirSync, unlinkSync } from 'fs'
import { join } from 'path'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const dataPath = getDataPath()
  const brandingDir = join(dataPath, '.branding')

  if (existsSync(brandingDir)) {
    const logoFiles = readdirSync(brandingDir).filter((f) => f.startsWith('logo.'))
    for (const f of logoFiles) {
      unlinkSync(join(brandingDir, f))
    }
  }

  return { success: true }
})
