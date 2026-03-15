import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash'),
  role: text('role', { enum: ['admin', 'user'] }).default('user').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  maxFileSize: integer('max_file_size').default(107_374_182_400).notNull(), // 100 GB
  canRead: integer('can_read', { mode: 'boolean' }).default(true).notNull(),
  canWrite: integer('can_write', { mode: 'boolean' }).default(true).notNull(),
  locale: text('locale').default('sv').notNull(),
  theme: text('theme').default('auto').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at'),
  setupToken: text('setup_token').unique(),
  setupTokenExpiresAt: text('setup_token_expires_at'),
})

export const passkeys = sqliteTable('passkeys', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  credentialId: text('credential_id').unique().notNull(),
  publicKey: text('public_key').notNull(),
  counter: integer('counter').default(0).notNull(),
  transports: text('transports'), // JSON array
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
})

export const invitations = sqliteTable('invitations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  token: text('token').unique().notNull(),
  createdBy: integer('created_by').references(() => users.id).notNull(),
  email: text('email'),
  expiresAt: text('expires_at').notNull(),
  usedAt: text('used_at'),
  usedBy: integer('used_by').references(() => users.id),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
})

export const files = sqliteTable('files', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  filename: text('filename').notNull(),
  path: text('path').notNull(),
  storageName: text('storage_name'),
  size: integer('size').default(0).notNull(),
  mimeType: text('mime_type'),
  thumbnailPath: text('thumbnail_path'),
  isDirectory: integer('is_directory', { mode: 'boolean' }).default(false).notNull(),
  parentId: integer('parent_id').references((): any => files.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at'),
})

export const shareLinks = sqliteTable('share_links', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  token: text('token').unique().notNull(),
  label: text('label'),
  expiresAt: text('expires_at').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
})

export const shareLinkFiles = sqliteTable('share_link_files', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  shareLinkId: integer('share_link_id').references(() => shareLinks.id, { onDelete: 'cascade' }).notNull(),
  fileId: integer('file_id').references(() => files.id, { onDelete: 'cascade' }).notNull(),
})

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

export const passwordResets = sqliteTable('password_resets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  token: text('token').unique().notNull(),
  expiresAt: text('expires_at').notNull(),
  usedAt: text('used_at'),
})

export const sessions = sqliteTable('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  token: text('token').unique().notNull(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
})
