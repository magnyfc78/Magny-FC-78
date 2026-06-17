/**
 * Model Account — comptes membres (table `users`).
 * Mapping API : last_name -> nom, first_name -> prenom.
 * Le hachage du mot de passe est fait dans la couche service (bcrypt) ;
 * ce model ne manipule que des hash déjà calculés.
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

const PUBLIC_FIELDS = `
  id, nom, prenom, email, role, avatar, actif,
  email_verified, email_verified_at, last_login, created_at
`;

const Account = {
  async findById(id) {
    const rows = await db.query(
      `SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Récupère un compte par email. Inclut le hash + tokens (usage interne auth).
   */
  async findByEmail(email, { includeDeleted = false } = {}) {
    const rows = await db.query(
      `SELECT id, nom, prenom, email, password, role, actif,
              email_verified, verification_token, verification_expires,
              reset_token, reset_expires, deleted_at
       FROM users WHERE email = ?`,
      [email.toLowerCase()]
    );
    const user = rows[0] || null;
    if (user && user.deleted_at && !includeDeleted) return null;
    return user;
  },

  async existsByEmail(email) {
    const rows = await db.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    return rows.length > 0;
  },

  /**
   * Hash du mot de passe (confirmation d'actions sensibles, ex. suppression).
   */
  async getPasswordHash(userId) {
    const rows = await db.query(
      'SELECT password FROM users WHERE id = ? AND deleted_at IS NULL',
      [userId]
    );
    return rows.length ? rows[0].password : null;
  },

  /**
   * Crée un compte (non vérifié) avec son token de vérification.
   * @returns l'id (uuid) créé.
   */
  async create({ nom, prenom, email, passwordHash, verificationToken, verificationExpires }, conn = db) {
    const runner = conn.query ? conn : db;
    const id = uuidv4();
    await runner.query(
      `INSERT INTO users
        (id, nom, prenom, email, password, role, actif, email_verified,
         verification_token, verification_expires, created_at)
       VALUES (?, ?, ?, ?, ?, 'user', 1, 0, ?, ?, NOW())`,
      [id, nom, prenom || null, email.toLowerCase(), passwordHash,
        verificationToken || null, verificationExpires || null]
    );
    return id;
  },

  async findByVerificationToken(token) {
    const rows = await db.query(
      `SELECT id, email, prenom, verification_expires
       FROM users
       WHERE verification_token = ? AND deleted_at IS NULL`,
      [token]
    );
    return rows[0] || null;
  },

  async markEmailVerified(userId) {
    await db.query(
      `UPDATE users
       SET email_verified = 1, email_verified_at = NOW(),
           verification_token = NULL, verification_expires = NULL
       WHERE id = ?`,
      [userId]
    );
  },

  async setResetToken(userId, token, expires) {
    await db.query(
      'UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?',
      [token, expires, userId]
    );
  },

  async findByResetToken(token) {
    const rows = await db.query(
      `SELECT id, email, prenom, reset_expires
       FROM users
       WHERE reset_token = ? AND deleted_at IS NULL`,
      [token]
    );
    return rows[0] || null;
  },

  /**
   * Met à jour le mot de passe et invalide le token de reset.
   */
  async updatePassword(userId, passwordHash) {
    await db.query(
      `UPDATE users
       SET password = ?, reset_token = NULL, reset_expires = NULL
       WHERE id = ?`,
      [passwordHash, userId]
    );
  },

  async touchLastLogin(userId) {
    await db.query('UPDATE users SET last_login = NOW() WHERE id = ?', [userId]);
  },

  /**
   * Soft-delete RGPD : anonymise et marque supprimé.
   */
  async softDelete(userId) {
    await db.query(
      `UPDATE users
       SET deleted_at = NOW(), actif = 0,
           email = CONCAT('deleted+', id, '@magnyfc78.invalid'),
           password = '', verification_token = NULL, reset_token = NULL
       WHERE id = ?`,
      [userId]
    );
  },

  /**
   * Liste admin des comptes avec le nombre de licences liées (GET /admin/accounts).
   */
  async listAdmin({ q, page = 1, limit = 20 } = {}) {
    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offset = (p - 1) * l;

    const clauses = ['u.deleted_at IS NULL'];
    const params = [];
    if (q) {
      clauses.push('(u.nom LIKE ? OR u.prenom LIKE ? OR u.email LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    const where = `WHERE ${clauses.join(' AND ')}`;

    const rows = await db.query(
      `SELECT u.id, u.nom, u.prenom, u.email, u.role, u.actif,
              u.email_verified, u.last_login, u.created_at,
              (SELECT COUNT(*) FROM account_licenses al WHERE al.user_id = u.id) AS nb_licences
       FROM users u
       ${where}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, l, offset]
    );
    const [{ total }] = await db.query(
      `SELECT COUNT(*) AS total FROM users u ${where}`,
      params
    );
    return { rows, total, page: p, limit: l };
  }
};

module.exports = Account;
