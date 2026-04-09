import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../config';
import { logger } from './logger';

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    fs.mkdirSync(config.dataDir, { recursive: true });
    const dbPath = path.join(config.dataDir, 'webgate.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    logger.info(`Database opened at ${dbPath}`);
  }
  return db;
}

export function initializeDatabase(): void {
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS published_apps (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      executable_path TEXT NOT NULL,
      command_line_args TEXT DEFAULT '',
      icon_base64 TEXT DEFAULT '',
      description TEXT DEFAULT '',
      allowed_users TEXT DEFAULT '[]',
      allowed_groups TEXT DEFAULT '[]',
      enabled INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS print_jobs (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      document_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'spooling',
      pdf_path TEXT,
      pdf_size INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      domain TEXT DEFAULT '',
      token TEXT NOT NULL,
      rdp_pid INTEGER,
      created_at TEXT NOT NULL,
      last_activity TEXT NOT NULL,
      active INTEGER DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(active);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
    CREATE INDEX IF NOT EXISTS idx_print_jobs_session ON print_jobs(session_id);
  `);

  logger.info('Database schema initialized');
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    logger.info('Database closed');
  }
}
