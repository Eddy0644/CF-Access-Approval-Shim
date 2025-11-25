import { v4 as uuidv4 } from 'uuid';
import { getDb } from './database.js';

/**
 * Request Store for managing authentication approval requests
 */
export const RequestStore = {
  /**
   * Create a new auth request
   */
  create({ clientReason, clientIp, deviceInfo }) {
    const db = getDb();
    const id = uuidv4();
    const now = Date.now();

    const stmt = db.prepare(`
      INSERT INTO auth_requests (id, status, client_reason, client_ip, device_info, created_at, updated_at)
      VALUES (?, 'pending', ?, ?, ?, ?, ?)
    `);

    stmt.run(id, clientReason || '', clientIp, deviceInfo, now, now);

    return {
      id,
      status: 'pending',
      clientReason: clientReason || '',
      clientIp,
      deviceInfo,
      createdAt: now,
      updatedAt: now,
    };
  },

  /**
   * Get a request by ID
   */
  get(id) {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT id, status, client_reason, reject_reason, client_ip, device_info,
             created_at, updated_at, approved_at
      FROM auth_requests WHERE id = ?
    `);

    const row = stmt.get(id);
    if (!row) return null;

    return {
      id: row.id,
      status: row.status,
      clientReason: row.client_reason,
      rejectReason: row.reject_reason,
      clientIp: row.client_ip,
      deviceInfo: row.device_info,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      approvedAt: row.approved_at,
    };
  },

  /**
   * Approve a request
   */
  approve(id) {
    const db = getDb();
    const now = Date.now();

    const stmt = db.prepare(`
      UPDATE auth_requests
      SET status = 'approved', updated_at = ?, approved_at = ?
      WHERE id = ? AND status = 'pending'
    `);

    const result = stmt.run(now, now, id);
    return result.changes > 0;
  },

  /**
   * Reject a request
   */
  reject(id, rejectReason = '') {
    const db = getDb();
    const now = Date.now();

    const stmt = db.prepare(`
      UPDATE auth_requests
      SET status = 'rejected', reject_reason = ?, updated_at = ?
      WHERE id = ? AND status = 'pending'
    `);

    const result = stmt.run(rejectReason, now, id);
    return result.changes > 0;
  },

  /**
   * Delete/cancel a request
   */
  delete(id) {
    const db = getDb();
    const stmt = db.prepare(`DELETE FROM auth_requests WHERE id = ?`);
    const result = stmt.run(id);
    return result.changes > 0;
  },

  /**
   * List all pending requests
   */
  listPending() {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT id, status, client_reason, client_ip, device_info, created_at
      FROM auth_requests
      WHERE status = 'pending'
      ORDER BY created_at DESC
    `);

    return stmt.all().map(row => ({
      id: row.id,
      status: row.status,
      clientReason: row.client_reason,
      clientIp: row.client_ip,
      deviceInfo: row.device_info,
      createdAt: row.created_at,
    }));
  },

  /**
   * List recent requests (all statuses)
   */
  listRecent(limit = 50) {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT id, status, client_reason, reject_reason, client_ip, device_info,
             created_at, updated_at, approved_at
      FROM auth_requests
      ORDER BY created_at DESC
      LIMIT ?
    `);

    return stmt.all(limit).map(row => ({
      id: row.id,
      status: row.status,
      clientReason: row.client_reason,
      rejectReason: row.reject_reason,
      clientIp: row.client_ip,
      deviceInfo: row.device_info,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      approvedAt: row.approved_at,
    }));
  },

  /**
   * Clean up old requests (older than specified days)
   */
  cleanup(days = 7) {
    const db = getDb();
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);

    const stmt = db.prepare(`
      DELETE FROM auth_requests WHERE created_at < ?
    `);

    const result = stmt.run(cutoff);
    return result.changes;
  },
};

export default RequestStore;
