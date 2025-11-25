import { getDb } from './database.js';

/**
 * SQLite Adapter for oidc-provider
 * Persists OIDC sessions, tokens, and other data to SQLite
 */
class SqliteAdapter {
  constructor(name) {
    this.name = name;
  }

  async upsert(id, payload, expiresIn) {
    const db = getDb();
    const expiresAt = expiresIn ? Math.floor(Date.now() / 1000) + expiresIn : null;

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO oidc_models (id, type, payload, grant_id, user_code, uid, expires_at, consumed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      this.name,
      JSON.stringify(payload),
      payload.grantId || null,
      payload.userCode || null,
      payload.uid || null,
      expiresAt,
      payload.consumed ? Math.floor(Date.now() / 1000) : null
    );
  }

  async find(id) {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT payload, expires_at, consumed_at FROM oidc_models
      WHERE id = ? AND type = ?
    `);

    const row = stmt.get(id, this.name);
    if (!row) return undefined;

    // Check if expired
    if (row.expires_at && row.expires_at < Math.floor(Date.now() / 1000)) {
      return undefined;
    }

    const payload = JSON.parse(row.payload);
    if (row.consumed_at) {
      payload.consumed = true;
    }

    return payload;
  }

  async findByUserCode(userCode) {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT payload, expires_at, consumed_at FROM oidc_models
      WHERE user_code = ? AND type = ?
    `);

    const row = stmt.get(userCode, this.name);
    if (!row) return undefined;

    if (row.expires_at && row.expires_at < Math.floor(Date.now() / 1000)) {
      return undefined;
    }

    const payload = JSON.parse(row.payload);
    if (row.consumed_at) {
      payload.consumed = true;
    }

    return payload;
  }

  async findByUid(uid) {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT payload, expires_at, consumed_at FROM oidc_models
      WHERE uid = ? AND type = ?
    `);

    const row = stmt.get(uid, this.name);
    if (!row) return undefined;

    if (row.expires_at && row.expires_at < Math.floor(Date.now() / 1000)) {
      return undefined;
    }

    const payload = JSON.parse(row.payload);
    if (row.consumed_at) {
      payload.consumed = true;
    }

    return payload;
  }

  async consume(id) {
    const db = getDb();
    const stmt = db.prepare(`
      UPDATE oidc_models SET consumed_at = ? WHERE id = ? AND type = ?
    `);
    stmt.run(Math.floor(Date.now() / 1000), id, this.name);
  }

  async destroy(id) {
    const db = getDb();
    const stmt = db.prepare(`
      DELETE FROM oidc_models WHERE id = ? AND type = ?
    `);
    stmt.run(id, this.name);
  }

  async revokeByGrantId(grantId) {
    const db = getDb();
    const stmt = db.prepare(`
      DELETE FROM oidc_models WHERE grant_id = ?
    `);
    stmt.run(grantId);
  }

  // Clean up expired entries (can be called periodically)
  static cleanup() {
    const db = getDb();
    const stmt = db.prepare(`
      DELETE FROM oidc_models WHERE expires_at IS NOT NULL AND expires_at < ?
    `);
    const result = stmt.run(Math.floor(Date.now() / 1000));
    return result.changes;
  }
}

export default SqliteAdapter;
