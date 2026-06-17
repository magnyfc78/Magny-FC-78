/**
 * Model AccountLicense — lien compte (users) <-> licence (table `account_licenses`).
 * relationship : 'self' (le titulaire EST le licencié) | 'parent' (tuteur d'un mineur).
 */

const db = require('../config/database');

const AccountLicense = {
  /**
   * Licences liées à un compte, enrichies des infos licence + équipe éventuelle.
   */
  async listByUser(userId) {
    return db.query(
      `SELECT al.id AS link_id, al.relationship, al.is_primary, al.created_at AS linked_at,
              l.id AS license_id, l.numero_licence, l.nom, l.prenom, l.date_naissance,
              l.sexe, l.categorie, l.saison, l.statut,
              TIMESTAMPDIFF(YEAR, l.date_naissance, CURDATE()) AS age,
              (TIMESTAMPDIFF(YEAR, l.date_naissance, CURDATE()) < 18) AS is_minor,
              j.id AS joueur_id, j.photo, j.equipe_id, e.nom AS equipe_nom
       FROM account_licenses al
       JOIN licenses l ON l.id = al.license_id
       LEFT JOIN joueurs j ON j.license_id = l.id
       LEFT JOIN equipes e ON e.id = j.equipe_id
       WHERE al.user_id = ?
       ORDER BY al.is_primary DESC, l.nom, l.prenom`,
      [userId]
    );
  },

  async findByUserAndLicense(userId, licenseId) {
    const rows = await db.query(
      'SELECT * FROM account_licenses WHERE user_id = ? AND license_id = ?',
      [userId, licenseId]
    );
    return rows[0] || null;
  },

  async findLinkById(linkId, userId) {
    const rows = await db.query(
      'SELECT * FROM account_licenses WHERE id = ? AND user_id = ?',
      [linkId, userId]
    );
    return rows[0] || null;
  },

  /**
   * Une licence est-elle déjà revendiquée comme 'self' par un compte ?
   * (Règle P5 : une licence 'self' ne peut appartenir qu'à un seul compte.)
   * @param {number} excludeUserId Compte à exclure (optionnel).
   */
  async isClaimedAsSelf(licenseId, excludeUserId = null) {
    const params = [licenseId];
    let sql = `SELECT 1 FROM account_licenses
               WHERE license_id = ? AND relationship = 'self'`;
    if (excludeUserId) {
      sql += ' AND user_id <> ?';
      params.push(excludeUserId);
    }
    const rows = await db.query(`${sql} LIMIT 1`, params);
    return rows.length > 0;
  },

  async countByUser(userId) {
    const [{ total }] = await db.query(
      'SELECT COUNT(*) AS total FROM account_licenses WHERE user_id = ?',
      [userId]
    );
    return total;
  },

  /**
   * Crée un lien. Si c'est la 1re licence du compte, elle devient principale.
   * @param {object} conn Connexion de transaction optionnelle.
   */
  async link({ userId, licenseId, relationship = 'self', isPrimary = null }, conn = db) {
    const runner = conn.query ? conn : db;

    let makePrimary = isPrimary;
    if (makePrimary === null) {
      const rows = await runner.query(
        'SELECT COUNT(*) AS total FROM account_licenses WHERE user_id = ?',
        [userId]
      );
      makePrimary = rows[0].total === 0; // 1re licence -> principale
    }

    const result = await runner.query(
      `INSERT INTO account_licenses (user_id, license_id, relationship, is_primary)
       VALUES (?, ?, ?, ?)`,
      [userId, licenseId, relationship, makePrimary ? 1 : 0]
    );
    return result.insertId;
  },

  /**
   * Supprime la liaison (pas la licence). Si c'était la principale, on en
   * promeut une autre automatiquement.
   */
  async unlink(linkId, userId) {
    return db.transaction(async (conn) => {
      const [link] = await conn.query(
        'SELECT * FROM account_licenses WHERE id = ? AND user_id = ?',
        [linkId, userId]
      );
      if (!link) return false;

      await conn.query('DELETE FROM account_licenses WHERE id = ?', [linkId]);

      if (link.is_primary) {
        const others = await conn.query(
          'SELECT id FROM account_licenses WHERE user_id = ? ORDER BY created_at LIMIT 1',
          [userId]
        );
        if (others.length) {
          await conn.query(
            'UPDATE account_licenses SET is_primary = 1 WHERE id = ?',
            [others[0].id]
          );
        }
      }
      return true;
    });
  },

  /**
   * Réaffecte les licences d'un compte source vers un compte cible (fusion P5).
   * À exécuter dans une transaction (conn fourni). Évite les doublons et
   * garantit qu'une seule licence reste principale côté cible.
   */
  async moveLicenses(sourceUserId, targetUserId, conn) {
    const runner = conn.query ? conn : db;
    const links = await runner.query(
      'SELECT id, license_id FROM account_licenses WHERE user_id = ?',
      [sourceUserId]
    );

    for (const link of links) {
      const dup = await runner.query(
        'SELECT id FROM account_licenses WHERE user_id = ? AND license_id = ?',
        [targetUserId, link.license_id]
      );
      if (dup.length) {
        // Cible déjà liée à cette licence -> on supprime le doublon source.
        await runner.query('DELETE FROM account_licenses WHERE id = ?', [link.id]);
      } else {
        await runner.query(
          'UPDATE account_licenses SET user_id = ?, is_primary = 0 WHERE id = ?',
          [targetUserId, link.id]
        );
      }
    }

    // Garantit une principale côté cible.
    const prim = await runner.query(
      'SELECT id FROM account_licenses WHERE user_id = ? AND is_primary = 1 LIMIT 1',
      [targetUserId]
    );
    if (!prim.length) {
      const any = await runner.query(
        'SELECT id FROM account_licenses WHERE user_id = ? ORDER BY created_at LIMIT 1',
        [targetUserId]
      );
      if (any.length) {
        await runner.query('UPDATE account_licenses SET is_primary = 1 WHERE id = ?', [any[0].id]);
      }
    }
    return links.length;
  },

  /**
   * Définit la licence principale (une seule à la fois par compte).
   */
  async setPrimary(linkId, userId) {
    return db.transaction(async (conn) => {
      const [link] = await conn.query(
        'SELECT id FROM account_licenses WHERE id = ? AND user_id = ?',
        [linkId, userId]
      );
      if (!link) return false;

      await conn.query(
        'UPDATE account_licenses SET is_primary = 0 WHERE user_id = ?',
        [userId]
      );
      await conn.query(
        'UPDATE account_licenses SET is_primary = 1 WHERE id = ?',
        [linkId]
      );
      return true;
    });
  }
};

module.exports = AccountLicense;
