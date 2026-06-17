/**
 * Model LoginHistory — historique des connexions (table `login_history`, P5).
 */

const db = require('../config/database');

const LoginHistory = {
  /**
   * Enregistre une tentative de connexion (réussie ou non).
   */
  async record(userId, { ip, userAgent } = {}, success = true) {
    await db.query(
      `INSERT INTO login_history (user_id, ip_address, user_agent, success)
       VALUES (?, ?, ?, ?)`,
      [userId, ip || null, (userAgent || '').slice(0, 255) || null, success ? 1 : 0]
    );
  },

  /**
   * Historique d'un compte, du plus récent au plus ancien.
   */
  async listByUser(userId, limit = 50) {
    const l = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    return db.query(
      `SELECT id, ip_address, user_agent, success, created_at
       FROM login_history
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, l]
    );
  }
};

module.exports = LoginHistory;
