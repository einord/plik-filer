export default defineEventHandler(async () => {
  const setupDone = await isSetupComplete()
  return { setupComplete: setupDone }
})
