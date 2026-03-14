import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import * as schema from '../database/schema'

let _db: ReturnType<typeof drizzle> | null = null
let _sqlite: Database.Database | null = null

export function useDb() {
  if (!_db) {
    const dbPath = process.env.NUXT_DATABASE_PATH || useRuntimeConfig().databasePath || './database/plik.db'

    // Ensure the directory exists
    const dir = dirname(dbPath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    _sqlite = new Database(dbPath)

    // Enable WAL mode for better concurrent read/write performance
    _sqlite.pragma('journal_mode = WAL')
    _sqlite.pragma('foreign_keys = ON')
    _sqlite.pragma('busy_timeout = 5000')

    _db = drizzle(_sqlite, { schema })

    // Run initial migration
    runMigrations(_sqlite)
  }

  return _db
}

function runMigrations(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      is_active INTEGER NOT NULL DEFAULT 1,
      max_file_size INTEGER NOT NULL DEFAULT 107374182400,
      can_read INTEGER NOT NULL DEFAULT 1,
      can_write INTEGER NOT NULL DEFAULT 1,
      locale TEXT NOT NULL DEFAULT 'sv',
      theme TEXT NOT NULL DEFAULT 'auto',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS passkeys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      credential_id TEXT UNIQUE NOT NULL,
      public_key TEXT NOT NULL,
      counter INTEGER NOT NULL DEFAULT 0,
      transports TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS invitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      created_by INTEGER NOT NULL REFERENCES users(id),
      email TEXT,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      used_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      path TEXT NOT NULL,
      size INTEGER NOT NULL DEFAULT 0,
      mime_type TEXT,
      thumbnail_path TEXT,
      is_directory INTEGER NOT NULL DEFAULT 0,
      parent_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS share_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      label TEXT,
      expires_at TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS share_link_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      share_link_id INTEGER NOT NULL REFERENCES share_links(id) ON DELETE CASCADE,
      file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
    CREATE INDEX IF NOT EXISTS idx_files_parent_id ON files(parent_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(token);
    CREATE INDEX IF NOT EXISTS idx_passkeys_user_id ON passkeys(user_id);
    CREATE INDEX IF NOT EXISTS idx_passkeys_credential_id ON passkeys(credential_id);
  `)
}

export function closeDb() {
  if (_sqlite) {
    _sqlite.close()
    _sqlite = null
    _db = null
  }
}
