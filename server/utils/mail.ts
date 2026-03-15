import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { eq } from 'drizzle-orm'
import { settings } from '#db'

let _transporter: Transporter | null = null

interface SmtpConfig {
  host: string
  port: number
  username: string
  password: string
  fromEmail: string
  fromName: string
  secure: boolean
}

async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const db = useDb()
  const result = await db.select().from(settings).where(eq(settings.key, 'smtp'))

  if (!result.length) return null

  try {
    return JSON.parse(result[0].value) as SmtpConfig
  } catch {
    return null
  }
}

async function getTransporter(): Promise<Transporter | null> {
  const config = await getSmtpConfig()
  if (!config) return null

  // Recreate transporter if config might have changed
  _transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.username,
      pass: config.password,
    },
  })

  return _transporter
}

export async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  const config = await getSmtpConfig()
  if (!config) {
    console.warn('SMTP not configured, skipping email to:', to)
    return false
  }

  const transporter = await getTransporter()
  if (!transporter) return false

  try {
    await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to,
      subject,
      html,
    })
    return true
  } catch (error) {
    console.error('Failed to send email:', error)
    return false
  }
}

export async function sendTestMail(to: string): Promise<{ success: boolean; error?: string }> {
  const config = await getSmtpConfig()
  if (!config) {
    return { success: false, error: 'SMTP not configured' }
  }

  const transporter = await getTransporter()
  if (!transporter) {
    return { success: false, error: 'Could not create transporter' }
  }

  try {
    await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to,
      subject: 'plik Filer — Test email',
      html: '<p>This is a test email from plik Filer. If you received this, your email settings are working correctly!</p>',
    })
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function sendInvitationMail(to: string, inviteUrl: string, serviceName: string) {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>You've been invited to ${serviceName}</h2>
      <p>Click the link below to create your account:</p>
      <p><a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 8px;">Create account</a></p>
      <p style="color: #6b7280; font-size: 14px;">If the button doesn't work, copy and paste this URL into your browser:</p>
      <p style="color: #6b7280; font-size: 14px; word-break: break-all;">${inviteUrl}</p>
    </div>
  `
  return sendMail(to, `You've been invited to ${serviceName}`, html)
}

export async function sendPasswordResetMail(to: string, resetUrl: string, serviceName: string) {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>${serviceName} — Password Reset</h2>
      <p>A password reset was requested for your account. Click the link below to set a new password:</p>
      <p><a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 8px;">Reset password</a></p>
      <p style="color: #6b7280; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
      <p style="color: #6b7280; font-size: 14px;">This link expires in 1 hour.</p>
    </div>
  `
  return sendMail(to, `${serviceName} — Password Reset`, html)
}

export async function sendSetupMail(to: string, setupUrl: string, serviceName: string) {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Welcome to ${serviceName}</h2>
      <p>An account has been created for you. Click the link below to set up your password:</p>
      <p><a href="${setupUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 8px;">Set up your account</a></p>
      <p style="color: #6b7280; font-size: 14px;">If the button doesn't work, copy and paste this URL into your browser:</p>
      <p style="color: #6b7280; font-size: 14px; word-break: break-all;">${setupUrl}</p>
      <p style="color: #6b7280; font-size: 14px;">This link expires in 7 days.</p>
    </div>
  `
  return sendMail(to, `Welcome to ${serviceName}`, html)
}
