
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const { to } = body

  if (!to) {
    throw createError({ statusCode: 400, statusMessage: 'Recipient email is required' })
  }

  const result = await sendTestMail(to)
  if (!result.success) {
    throw createError({ statusCode: 500, statusMessage: result.error || 'Failed to send test email' })
  }

  return { success: true }
})
