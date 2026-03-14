export interface User {
  id: number
  email: string | null
  name: string
  role: 'admin' | 'user'
  isActive: boolean
  maxFileSize: number
  canRead: boolean
  canWrite: boolean
  locale: string
  theme: string
  createdAt: string
  updatedAt?: string
  setupCompleted?: boolean
}

export interface Passkey {
  id: number
  userId: number
  credentialId: string
  publicKey: string
  counter: number
  transports?: string[]
  createdAt: string
}

export interface FileItem {
  id: number
  userId: number
  filename: string
  path: string
  size: number
  mimeType?: string
  thumbnailPath?: string
  isDirectory: boolean
  parentId?: number
  createdAt: string
  updatedAt?: string
}

export interface ShareLink {
  id: number
  createdBy: number
  token: string
  label?: string
  expiresAt: string
  isActive: boolean
  files: FileItem[]
  createdAt: string
}

export interface Invitation {
  id: number
  token: string
  createdBy: number
  email?: string
  expiresAt: string
  usedAt?: string
  usedBy?: number
}

export interface BrandingSettings {
  logoUrl?: string
  serviceName: string
  domainName?: string
}

export interface SmtpSettings {
  host: string
  port: number
  username: string
  password: string
  fromEmail: string
  fromName: string
  secure: boolean
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface UploadProgress {
  fileId: string
  filename: string
  loaded: number
  total: number
  percentage: number
  speed: number
  timeRemaining: number
  status: 'pending' | 'uploading' | 'complete' | 'error' | 'paused'
  error?: string
}

export interface Session {
  id: number
  userId: number
  token: string
  expiresAt: string
  createdAt: string
}
