/**
 * Model Invitation — invitations admin (table `invitations`, étendue P2 avec license_id).
 * Scénario 4 : l'admin génère un code lié à une licence, envoyé par email.
 */

const db = require('../config/database');

const Invitation = {
  /**
   * Crée une invitation.
   * @param {object} data { clubId, email, token, roleInvite, licenseId,
   *                        equipeId, joueurId, inviteParUserId, expireLe }
   */
  async create(data) {
    const result = await db.query(
      `INSERT INTO invitations
        (club_id, email, token, role_invite, license_id, equipe_id, joueur_id,
         statut, invite_par, expire_le)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'en_attente', ?, ?)`,
      [
        data.clubId || 1,
        data.email ? data.email.toLowerCase() : null,
        data.token,
        data.roleInvite || 'joueur',
        data.licenseId || null,
        data.equipeId || null,
        data.joueurId || null,
        data.inviteParUserId || null,
        data.expireLe || null
      ]
    );
    return result.insertId;
  },

  /**
   * Récupère une invitation par son code/token, avec les infos de licence.
   */
  async findByToken(token) {
    const rows = await db.query(
      `SELECT i.*,
              l.numero_licence, l.nom AS license_nom, l.prenom AS license_prenom,
              l.date_naissance AS license_date_naissance
       FROM invitations i
       LEFT JOIN licenses l ON l.id = i.license_id
       WHERE i.token = ?`,
      [token]
    );
    return rows[0] || null;
  },

  async markAccepted(id) {
    await db.query(
      `UPDATE invitations
       SET statut = 'acceptee', acceptee_le = NOW()
       WHERE id = ?`,
      [id]
    );
  },

  async cancel(id) {
    await db.query(
      `UPDATE invitations SET statut = 'annulee' WHERE id = ? AND statut = 'en_attente'`,
      [id]
    );
  },

  /**
   * Liste des invitations d'un club, enrichies du nom de licence.
   */
  async listByClub(clubId = 1, { statut } = {}) {
    const params = [clubId];
    let sql = `
      SELECT i.id, i.email, i.token, i.role_invite, i.license_id, i.statut,
             i.expire_le, i.acceptee_le, i.created_at,
             l.numero_licence, l.nom AS license_nom, l.prenom AS license_prenom
      FROM invitations i
      LEFT JOIN licenses l ON l.id = i.license_id
      WHERE i.club_id = ?`;
    if (statut) {
      sql += ' AND i.statut = ?';
      params.push(statut);
    }
    sql += ' ORDER BY i.created_at DESC';
    return db.query(sql, params);
  }
};

module.exports = Invitation;
