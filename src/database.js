import Database from 'better-sqlite3';
import config from './config.js';
import logger from './logger.js';

let db = null;

export const initDatabase = () => {
  db = new Database(config.dbPath);

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');

  // Create tables for request store
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_requests (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'pending',
      client_reason TEXT,
      reject_reason TEXT,
      client_ip TEXT,
      device_info TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      approved_at INTEGER
    )
  `);

  // Create tables for OIDC provider data persistence
  db.exec(`
    CREATE TABLE IF NOT EXISTS oidc_models (
      id TEXT NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      grant_id TEXT,
      user_code TEXT,
      uid TEXT,
      expires_at INTEGER,
      consumed_at INTEGER,
      PRIMARY KEY (id, type)
    )
  `);

  // Create indexes for better query performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_oidc_grant_id ON oidc_models(grant_id) WHERE grant_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_oidc_user_code ON oidc_models(user_code) WHERE user_code IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_oidc_uid ON oidc_models(uid) WHERE uid IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_oidc_expires ON oidc_models(expires_at) WHERE expires_at IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_auth_status ON auth_requests(status);
  `);

  logger.dbInit();
  return db;
};

export const getDb = () => {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
};

export default { initDatabase, getDb };
