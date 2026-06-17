/**
 * Model License — registre des licences FFF (table `licenses`).
 * Accès données en requêtes préparées (pas d'ORM, cohérent avec le repo).
 */

const db = require('../config/database');

const SAFE_FIELDS = `
  id, club_id, numero_licence, nom, prenom, date_naissance, sexe,
  email, telephone, adresse, code_postal, ville, categorie,
  saison, statut, source, imported_at, created_at, updated_at
`;

const License = {
  async findById(id) {
    const rows = await db.query(
      `SELECT ${SAFE_FIELDS} FROM licenses WHERE id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Licence active correspondant à un email (check-email, scénario 1).
   * On privilégie la saison la plus récente.
   */
  async findActiveByEmail(email) {
    const rows = await db.query(
      `SELECT ${SAFE_FIELDS} FROM licenses
       WHERE email = ? AND statut = 'active'
       ORDER BY saison DESC, id DESC
       LIMIT 1`,
      [email.toLowerCase()]
    );
    return rows[0] || null;
  },

  /**
   * Vérification d'identité (scénarios 2/3, register avec licence) :
   * numéro de licence + date de naissance, licence active.
   * @param {string} numero
   * @param {string} birthdate Format 'YYYY-MM-DD'
   */
  async findActiveByNumeroAndBirthdate(numero, birthdate) {
    const rows = await db.query(
      `SELECT ${SAFE_FIELDS} FROM licenses
       WHERE numero_licence = ? AND date_naissance = ? AND statut = 'active'
       ORDER BY saison DESC, id DESC
       LIMIT 1`,
      [numero, birthdate]
    );
    return rows[0] || null;
  },

  /**
   * Liste admin avec filtres (GET /admin/licenses).
   * filters: { q, categorie, saison, statut, linked ('1'|'0'), page, limit }
   * Retourne { rows, total }. Chaque ligne expose `nb_comptes` (liaisons).
   */
  async searchAdmin(filters = {}) {
    const { where, params } = License._buildWhere(filters);
    const page = Math.max(parseInt(filters.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 20, 1), 100);
    const offset = (page - 1) * limit;

    const rows = await db.query(
      `SELECT l.*,
              (SELECT COUNT(*) FROM account_licenses al WHERE al.license_id = l.id) AS nb_comptes
       FROM licenses l
       ${where}
       ORDER BY l.nom, l.prenom
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [{ total }] = await db.query(
      `SELECT COUNT(*) AS total FROM licenses l ${where}`,
      params
    );

    return { rows, total, page, limit };
  },

  _buildWhere(filters) {
    const clauses = [];
    const params = [];

    if (filters.q) {
      clauses.push('(l.nom LIKE ? OR l.prenom LIKE ? OR l.numero_licence LIKE ? OR l.email LIKE ?)');
      const like = `%${filters.q}%`;
      params.push(like, like, like, like);
    }
    if (filters.categorie) {
      clauses.push('l.categorie = ?');
      params.push(filters.categorie);
    }
    if (filters.saison) {
      clauses.push('l.saison = ?');
      params.push(filters.saison);
    }
    if (filters.statut) {
      clauses.push('l.statut = ?');
      params.push(filters.statut);
    }
    if (filters.linked === '1' || filters.linked === true) {
      clauses.push('EXISTS (SELECT 1 FROM account_licenses al WHERE al.license_id = l.id)');
    } else if (filters.linked === '0' || filters.linked === false) {
      clauses.push('NOT EXISTS (SELECT 1 FROM account_licenses al WHERE al.license_id = l.id)');
    }

    return {
      where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
      params
    };
  },

  /**
   * Upsert d'une licence (import FFF). Clé : (numero_licence, saison).
   * @param {object} data Champs de la licence (+ saison, club_id).
   * @param {object} [conn] Connexion de transaction optionnelle.
   * @returns {Promise<'inserted'|'updated'>}
   */
  async upsert(data, conn = db) {
    const runner = conn.query ? conn : db;
    const result = await runner.query(
      `INSERT INTO licenses
        (club_id, numero_licence, nom, prenom, date_naissance, sexe, email,
         telephone, adresse, code_postal, ville, categorie, saison, statut,
         source, imported_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         nom = VALUES(nom), prenom = VALUES(prenom),
         date_naissance = VALUES(date_naissance), sexe = VALUES(sexe),
         email = VALUES(email), telephone = VALUES(telephone),
         adresse = VALUES(adresse), code_postal = VALUES(code_postal),
         ville = VALUES(ville), categorie = VALUES(categorie),
         statut = VALUES(statut), source = VALUES(source),
         imported_at = NOW()`,
      [
        data.club_id || 1,
        data.numero_licence,
        data.nom,
        data.prenom,
        data.date_naissance,
        data.sexe || null,
        data.email ? data.email.toLowerCase() : null,
        data.telephone || null,
        data.adresse || null,
        data.code_postal || null,
        data.ville || null,
        data.categorie || null,
        data.saison,
        data.statut || 'active',
        data.source || 'import_fff'
      ]
    );
    // mysql2 : affectedRows = 1 (insert), 2 (update sur ON DUPLICATE KEY).
    return result.affectedRows === 1 ? 'inserted' : 'updated';
  }
};

module.exports = License;
