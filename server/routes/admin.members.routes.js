/**
 * Routes Administration - Gestion des licences et comptes membres
 * CRUD complet pour les admins
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { protect, restrictTo } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { sendEmail } = require('../utils/email');
const config = require('../config');
const { generateInvitationCode } = require('../middleware/memberAuth');

const router = express.Router();

// Toutes les routes nécessitent authentification admin
router.use(protect);
router.use(restrictTo('admin', 'editor'));

// Helper pour logger l'activité admin
async function logAdminActivity(userId, action, entity, entityId, details = null) {
  try {
    await db.pool.execute(
      'INSERT INTO activity_logs (user_id, action, entite, entite_id, details) VALUES (?, ?, ?, ?, ?)',
      [userId, action, entity, entityId, details ? JSON.stringify(details) : null]
    );
  } catch (e) {
    logger.error('Erreur log activité:', e);
  }
}

// =====================================================
// DASHBOARD ADHÉRENTS
// =====================================================
router.get('/dashboard', async (req, res, next) => {
  try {
    const season = req.query.season || getCurrentSeason();

    // Stats globales
    const [[{ total_licenses }]] = await db.pool.execute(
      'SELECT COUNT(*) as total_licenses FROM licenses WHERE season = ? AND is_active = TRUE',
      [season]
    );

    const [[{ total_accounts }]] = await db.pool.execute(
      'SELECT COUNT(*) as total_accounts FROM member_accounts WHERE is_active = TRUE'
    );

    const [[{ verified_accounts }]] = await db.pool.execute(
      'SELECT COUNT(*) as verified_accounts FROM member_accounts WHERE is_verified = TRUE AND is_active = TRUE'
    );

    const [[{ linked_licenses }]] = await db.pool.execute(
      `SELECT COUNT(DISTINCT license_id) as linked_licenses
       FROM account_licenses al
       JOIN licenses l ON al.license_id = l.id
       WHERE l.season = ? AND l.is_active = TRUE`,
      [season]
    );

    // Stats par catégorie
    const [categoryStats] = await db.pool.execute(
      `SELECT
        category,
        COUNT(*) as count,
        SUM(CASE WHEN gender = 'M' THEN 1 ELSE 0 END) as male,
        SUM(CASE WHEN gender = 'F' THEN 1 ELSE 0 END) as female
       FROM licenses
       WHERE season = ? AND is_active = TRUE
       GROUP BY category
       ORDER BY FIELD(category, 'U7', 'U9', 'U11', 'U13', 'U15', 'U17', 'U19', 'Seniors', 'Vétérans')`,
      [season]
    );

    // Dernières inscriptions
    const [recentAccounts] = await db.pool.execute(
      `SELECT id, email, first_name, last_name, is_verified, created_at
       FROM member_accounts
       ORDER BY created_at DESC
       LIMIT 10`
    );

    // Licences sans compte rattaché
    const [[{ unlinked_count }]] = await db.pool.execute(
      `SELECT COUNT(*) as unlinked_count
       FROM licenses l
       LEFT JOIN account_licenses al ON l.id = al.license_id
       WHERE l.season = ? AND l.is_active = TRUE AND al.id IS NULL`,
      [season]
    );

    res.json({
      success: true,
      data: {
        season,
        stats: {
          totalLicenses: total_licenses,
          totalAccounts: total_accounts,
          verifiedAccounts: verified_accounts,
          linkedLicenses: linked_licenses,
          unlinkedLicenses: total_licenses - linked_licenses,
          linkRate: total_licenses > 0 ? Math.round((linked_licenses / total_licenses) * 100) : 0
        },
        categoryStats,
        recentAccounts,
        unlinkedCount: unlinked_count
      }
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// LICENCES - CRUD
// =====================================================

// Liste des licences avec filtres
router.get('/licenses', async (req, res, next) => {
  try {
    const {
      season = getCurrentSeason(),
      category,
      team_id,
      search,
      linked,
      page = 1,
      limit = 50
    } = req.query;

    let sql = `
      SELECT
        l.*,
        e.nom as team_name,
        ma.email as account_email,
        ma.first_name as account_first_name,
        ma.last_name as account_last_name,
        al.relationship
      FROM licenses l
      LEFT JOIN equipes e ON l.team_id = e.id
      LEFT JOIN account_licenses al ON l.id = al.license_id
      LEFT JOIN member_accounts ma ON al.account_id = ma.id
      WHERE l.season = ?
    `;
    const params = [season];

    if (category) {
      sql += ' AND l.category = ?';
      params.push(category);
    }

    if (team_id) {
      sql += ' AND l.team_id = ?';
      params.push(team_id);
    }

    if (search) {
      sql += ' AND (l.first_name LIKE ? OR l.last_name LIKE ? OR l.license_number LIKE ? OR l.email LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (linked === 'true') {
      sql += ' AND al.id IS NOT NULL';
    } else if (linked === 'false') {
      sql += ' AND al.id IS NULL';
    }

    sql += ' ORDER BY l.last_name, l.first_name';

    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    sql += ` LIMIT ${parseInt(limit)} OFFSET ${offset}`;

    const [licenses] = await db.pool.execute(sql, params);

    // Total count pour pagination
    let countSql = `
      SELECT COUNT(*) as total FROM licenses l
      LEFT JOIN account_licenses al ON l.id = al.license_id
      WHERE l.season = ?
    `;
    const countParams = [season];

    if (category) {
      countSql += ' AND l.category = ?';
      countParams.push(category);
    }
    if (team_id) {
      countSql += ' AND l.team_id = ?';
      countParams.push(team_id);
    }
    if (search) {
      countSql += ' AND (l.first_name LIKE ? OR l.last_name LIKE ? OR l.license_number LIKE ?)';
      const searchTerm = `%${search}%`;
      countParams.push(searchTerm, searchTerm, searchTerm);
    }
    if (linked === 'true') {
      countSql += ' AND al.id IS NOT NULL';
    } else if (linked === 'false') {
      countSql += ' AND al.id IS NULL';
    }

    const [[{ total }]] = await db.pool.execute(countSql, countParams);

    res.json({
      success: true,
      data: {
        licenses,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

// Détails d'une licence
router.get('/licenses/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const [licenses] = await db.pool.execute(
      `SELECT l.*, e.nom as team_name
       FROM licenses l
       LEFT JOIN equipes e ON l.team_id = e.id
       WHERE l.id = ?`,
      [id]
    );

    if (!licenses.length) {
      throw new AppError('Licence non trouvée.', 404);
    }

    // Compte lié
    const [linkedAccounts] = await db.pool.execute(
      `SELECT ma.id, ma.email, ma.first_name, ma.last_name, al.relationship, al.is_primary, al.verified_at
       FROM member_accounts ma
       JOIN account_licenses al ON ma.id = al.account_id
       WHERE al.license_id = ?`,
      [id]
    );

    // Invitations actives
    const [invitations] = await db.pool.execute(
      `SELECT id, invitation_code, invited_email, relationship, expires_at, use_count, max_uses, created_at
       FROM license_invitations
       WHERE license_id = ? AND revoked_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        license: licenses[0],
        linkedAccounts,
        invitations
      }
    });

  } catch (error) {
    next(error);
  }
});

// Créer une licence
router.post('/licenses', async (req, res, next) => {
  try {
    const {
      license_number,
      first_name,
      last_name,
      birth_date,
      gender,
      category,
      team_id,
      email,
      phone,
      address,
      postal_code,
      city,
      emergency_contact_name,
      emergency_contact_phone,
      season = getCurrentSeason()
    } = req.body;

    // Validation
    if (!license_number || !first_name || !last_name || !birth_date || !gender) {
      throw new AppError('Champs obligatoires manquants.', 400);
    }

    // Vérifier unicité du numéro de licence
    const [existing] = await db.pool.execute(
      'SELECT id FROM licenses WHERE license_number = ?',
      [license_number]
    );

    if (existing.length) {
      throw new AppError('Ce numéro de licence existe déjà.', 400);
    }

    const [result] = await db.pool.execute(
      `INSERT INTO licenses
       (license_number, first_name, last_name, birth_date, gender, category, team_id,
        email, phone, address, postal_code, city,
        emergency_contact_name, emergency_contact_phone, season)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        license_number, first_name, last_name, birth_date, gender, category || null,
        team_id || null, email || null, phone || null, address || null,
        postal_code || null, city || null,
        emergency_contact_name || null, emergency_contact_phone || null, season
      ]
    );

    await logAdminActivity(req.user.id, 'create', 'licenses', result.insertId, { license_number, first_name, last_name });

    res.status(201).json({
      success: true,
      message: 'Licence créée avec succès.',
      data: { id: result.insertId }
    });

  } catch (error) {
    next(error);
  }
});

// Modifier une licence
router.put('/licenses/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      license_number,
      first_name,
      last_name,
      birth_date,
      gender,
      category,
      team_id,
      email,
      phone,
      address,
      postal_code,
      city,
      emergency_contact_name,
      emergency_contact_phone,
      medical_certificate_date,
      medical_certificate_valid,
      is_active,
      notes
    } = req.body;

    // Vérifier existence
    const [existing] = await db.pool.execute('SELECT id FROM licenses WHERE id = ?', [id]);
    if (!existing.length) {
      throw new AppError('Licence non trouvée.', 404);
    }

    await db.pool.execute(
      `UPDATE licenses SET
        license_number = ?, first_name = ?, last_name = ?, birth_date = ?, gender = ?,
        category = ?, team_id = ?, email = ?, phone = ?, address = ?, postal_code = ?, city = ?,
        emergency_contact_name = ?, emergency_contact_phone = ?,
        medical_certificate_date = ?, medical_certificate_valid = ?,
        is_active = ?, notes = ?
       WHERE id = ?`,
      [
        license_number, first_name, last_name, birth_date, gender,
        category || null, team_id || null, email || null, phone || null,
        address || null, postal_code || null, city || null,
        emergency_contact_name || null, emergency_contact_phone || null,
        medical_certificate_date || null, medical_certificate_valid || false,
        is_active !== false, notes || null, id
      ]
    );

    await logAdminActivity(req.user.id, 'update', 'licenses', id, { license_number });

    res.json({
      success: true,
      message: 'Licence mise à jour.'
    });

  } catch (error) {
    next(error);
  }
});

// Supprimer une licence
router.delete('/licenses/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Vérifier existence
    const [existing] = await db.pool.execute(
      'SELECT license_number FROM licenses WHERE id = ?',
      [id]
    );

    if (!existing.length) {
      throw new AppError('Licence non trouvée.', 404);
    }

    await logAdminActivity(req.user.id, 'delete', 'licenses', id, { license_number: existing[0].license_number });

    await db.pool.execute('DELETE FROM licenses WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Licence supprimée.'
    });

  } catch (error) {
    next(error);
  }
});

// Import en masse des licences (CSV)
router.post('/licenses/import', async (req, res, next) => {
  try {
    const { licenses, season = getCurrentSeason() } = req.body;

    if (!Array.isArray(licenses) || licenses.length === 0) {
      throw new AppError('Liste de licences vide ou invalide.', 400);
    }

    let imported = 0;
    let updated = 0;
    let errors = [];

    for (const lic of licenses) {
      try {
        // Vérifier si la licence existe déjà
        const [existing] = await db.pool.execute(
          'SELECT id FROM licenses WHERE license_number = ?',
          [lic.license_number]
        );

        if (existing.length) {
          // Mise à jour
          await db.pool.execute(
            `UPDATE licenses SET
              first_name = ?, last_name = ?, birth_date = ?, gender = ?,
              category = ?, email = ?, phone = ?, season = ?
             WHERE license_number = ?`,
            [
              lic.first_name, lic.last_name, lic.birth_date, lic.gender,
              lic.category || null, lic.email || null, lic.phone || null,
              season, lic.license_number
            ]
          );
          updated++;
        } else {
          // Création
          await db.pool.execute(
            `INSERT INTO licenses
             (license_number, first_name, last_name, birth_date, gender, category, email, phone, season)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              lic.license_number, lic.first_name, lic.last_name, lic.birth_date,
              lic.gender, lic.category || null, lic.email || null, lic.phone || null, season
            ]
          );
          imported++;
        }
      } catch (err) {
        errors.push({ license: lic.license_number, error: err.message });
      }
    }

    await logAdminActivity(req.user.id, 'import', 'licenses', null, { imported, updated, errors: errors.length });

    res.json({
      success: true,
      message: `Import terminé: ${imported} créées, ${updated} mises à jour, ${errors.length} erreurs.`,
      data: { imported, updated, errors }
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// INVITATIONS
// =====================================================

// Créer une invitation pour rattacher une licence
router.post('/licenses/:id/invitations', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { email, relationship = 'parent', expirationDays = 7 } = req.body;

    // Vérifier que la licence existe
    const [licenses] = await db.pool.execute(
      'SELECT license_number, first_name, last_name, email as license_email FROM licenses WHERE id = ?',
      [id]
    );

    if (!licenses.length) {
      throw new AppError('Licence non trouvée.', 404);
    }

    const license = licenses[0];

    // Générer le code
    const code = generateInvitationCode();
    const expiresAt = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000);

    // Créer l'invitation
    const [result] = await db.pool.execute(
      `INSERT INTO license_invitations
       (license_id, invitation_code, invited_email, relationship, expires_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, code, email || null, relationship, expiresAt, req.user.id]
    );

    // Envoyer l'email si adresse fournie
    const targetEmail = email || license.license_email;
    if (targetEmail) {
      const linkUrl = `${config.server.baseUrl || 'https://magnyfc78.com'}/espace-membre/link?code=${code}`;

      await sendEmail({
        to: targetEmail,
        subject: `[Magny FC 78] Invitation à rattacher une licence`,
        text: `
Bonjour,

Vous êtes invité(e) à rattacher la licence de ${license.first_name} ${license.last_name} à votre espace membre Magny FC 78.

Votre code d'invitation : ${code}

Ou cliquez sur ce lien : ${linkUrl}

Ce code est valable jusqu'au ${expiresAt.toLocaleDateString('fr-FR')}.

Si vous n'avez pas encore de compte, créez-en un sur magnyfc78.com puis utilisez ce code.

Sportivement,
L'équipe du Magny FC 78
        `,
        html: `
<p>Bonjour,</p>
<p>Vous êtes invité(e) à rattacher la licence de <strong>${license.first_name} ${license.last_name}</strong> à votre espace membre Magny FC 78.</p>
<p><strong>Votre code d'invitation :</strong> <code style="font-size: 1.2em; background: #f0f0f0; padding: 5px 10px;">${code}</code></p>
<p>Ou <a href="${linkUrl}">cliquez ici</a> pour rattacher directement cette licence.</p>
<p><small>Ce code est valable jusqu'au ${expiresAt.toLocaleDateString('fr-FR')}.</small></p>
        `
      });
    }

    await logAdminActivity(req.user.id, 'create', 'license_invitations', result.insertId, {
      license_number: license.license_number,
      code,
      email: targetEmail
    });

    res.status(201).json({
      success: true,
      message: targetEmail
        ? `Invitation envoyée à ${targetEmail}.`
        : 'Code d\'invitation créé.',
      data: {
        id: result.insertId,
        code,
        expiresAt
      }
    });

  } catch (error) {
    next(error);
  }
});

// Révoquer une invitation
router.delete('/invitations/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    await db.pool.execute(
      'UPDATE license_invitations SET revoked_at = NOW(), revoked_by = ? WHERE id = ?',
      [req.user.id, id]
    );

    res.json({
      success: true,
      message: 'Invitation révoquée.'
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// COMPTES MEMBRES
// =====================================================

// Liste des comptes membres
router.get('/accounts', async (req, res, next) => {
  try {
    const { search, verified, page = 1, limit = 50 } = req.query;

    let sql = `
      SELECT
        ma.*,
        (SELECT COUNT(*) FROM account_licenses WHERE account_id = ma.id) as license_count
      FROM member_accounts ma
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ' AND (ma.email LIKE ? OR ma.first_name LIKE ? OR ma.last_name LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (verified === 'true') {
      sql += ' AND ma.is_verified = TRUE';
    } else if (verified === 'false') {
      sql += ' AND ma.is_verified = FALSE';
    }

    sql += ' ORDER BY ma.created_at DESC';

    const offset = (parseInt(page) - 1) * parseInt(limit);
    sql += ` LIMIT ${parseInt(limit)} OFFSET ${offset}`;

    const [accounts] = await db.pool.execute(sql, params);

    // Masquer les données sensibles
    const safeAccounts = accounts.map(a => ({
      id: a.id,
      email: a.email,
      firstName: a.first_name,
      lastName: a.last_name,
      fullName: `${a.first_name} ${a.last_name}`,
      phone: a.phone,
      role: a.role,
      isVerified: a.is_verified,
      isActive: a.is_active,
      lastLogin: a.last_login,
      loginCount: a.login_count,
      licenseCount: a.license_count,
      createdAt: a.created_at
    }));

    res.json({
      success: true,
      data: { accounts: safeAccounts }
    });

  } catch (error) {
    next(error);
  }
});

// Détails d'un compte membre
router.get('/accounts/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const [accounts] = await db.pool.execute(
      `SELECT id, email, first_name, last_name, phone, role,
              is_verified, verified_at, is_active, last_login, login_count,
              notify_email, notify_match, notify_training, notify_news, created_at
       FROM member_accounts WHERE id = ?`,
      [id]
    );

    if (!accounts.length) {
      throw new AppError('Compte non trouvé.', 404);
    }

    // Licences liées
    const [licenses] = await db.pool.execute(
      `SELECT l.id, l.license_number, l.first_name, l.last_name, l.category,
              al.relationship, al.is_primary, al.verified_at
       FROM licenses l
       JOIN account_licenses al ON l.id = al.license_id
       WHERE al.account_id = ?`,
      [id]
    );

    // Sessions actives
    const [sessions] = await db.pool.execute(
      `SELECT id, device_info, ip_address, last_activity, created_at
       FROM member_sessions
       WHERE account_id = ? AND is_active = TRUE AND expires_at > NOW()`,
      [id]
    );

    res.json({
      success: true,
      data: {
        account: accounts[0],
        licenses,
        sessions
      }
    });

  } catch (error) {
    next(error);
  }
});

// Modifier un compte membre (admin)
router.put('/accounts/:id', restrictTo('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, is_active, is_verified } = req.body;

    const updates = [];
    const values = [];

    if (role !== undefined) {
      updates.push('role = ?');
      values.push(role);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active ? 1 : 0);
    }
    if (is_verified !== undefined) {
      updates.push('is_verified = ?');
      values.push(is_verified ? 1 : 0);
      if (is_verified) {
        updates.push('verified_at = NOW()');
      }
    }

    if (updates.length === 0) {
      throw new AppError('Aucune modification.', 400);
    }

    values.push(id);

    await db.pool.execute(
      `UPDATE member_accounts SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    await logAdminActivity(req.user.id, 'update', 'member_accounts', id, { role, is_active, is_verified });

    res.json({
      success: true,
      message: 'Compte mis à jour.'
    });

  } catch (error) {
    next(error);
  }
});

// Lier manuellement une licence à un compte
router.post('/accounts/:accountId/licenses/:licenseId', restrictTo('admin'), async (req, res, next) => {
  try {
    const { accountId, licenseId } = req.params;
    const { relationship = 'parent' } = req.body;

    // Vérifier que le compte et la licence existent
    const [accounts] = await db.pool.execute('SELECT id FROM member_accounts WHERE id = ?', [accountId]);
    const [licenses] = await db.pool.execute('SELECT id FROM licenses WHERE id = ?', [licenseId]);

    if (!accounts.length) throw new AppError('Compte non trouvé.', 404);
    if (!licenses.length) throw new AppError('Licence non trouvée.', 404);

    // Vérifier si le lien n'existe pas déjà
    const [existing] = await db.pool.execute(
      'SELECT id FROM account_licenses WHERE account_id = ? AND license_id = ?',
      [accountId, licenseId]
    );

    if (existing.length) {
      throw new AppError('Cette licence est déjà liée à ce compte.', 400);
    }

    await db.pool.execute(
      `INSERT INTO account_licenses (account_id, license_id, relationship, verified_at, verified_by)
       VALUES (?, ?, ?, NOW(), ?)`,
      [accountId, licenseId, relationship, req.user.id]
    );

    await logAdminActivity(req.user.id, 'link', 'account_licenses', null, { accountId, licenseId, relationship });

    res.status(201).json({
      success: true,
      message: 'Licence liée au compte.'
    });

  } catch (error) {
    next(error);
  }
});

// Délier une licence d'un compte
router.delete('/accounts/:accountId/licenses/:licenseId', restrictTo('admin'), async (req, res, next) => {
  try {
    const { accountId, licenseId } = req.params;

    await db.pool.execute(
      'DELETE FROM account_licenses WHERE account_id = ? AND license_id = ?',
      [accountId, licenseId]
    );

    await logAdminActivity(req.user.id, 'unlink', 'account_licenses', null, { accountId, licenseId });

    res.json({
      success: true,
      message: 'Licence détachée du compte.'
    });

  } catch (error) {
    next(error);
  }
});

// Supprimer un compte membre
router.delete('/accounts/:id', restrictTo('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const [accounts] = await db.pool.execute(
      'SELECT email FROM member_accounts WHERE id = ?',
      [id]
    );

    if (!accounts.length) {
      throw new AppError('Compte non trouvé.', 404);
    }

    await logAdminActivity(req.user.id, 'delete', 'member_accounts', id, { email: accounts[0].email });

    await db.pool.execute('DELETE FROM member_accounts WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Compte supprimé.'
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// STATISTIQUES ET EXPORT
// =====================================================

// Export des licences (JSON)
router.get('/licenses/export', async (req, res, next) => {
  try {
    const { season = getCurrentSeason(), format = 'json' } = req.query;

    const [licenses] = await db.pool.execute(
      `SELECT
        l.*,
        e.nom as team_name,
        ma.email as account_email
       FROM licenses l
       LEFT JOIN equipes e ON l.team_id = e.id
       LEFT JOIN account_licenses al ON l.id = al.license_id
       LEFT JOIN member_accounts ma ON al.account_id = ma.id
       WHERE l.season = ?
       ORDER BY l.category, l.last_name, l.first_name`,
      [season]
    );

    if (format === 'csv') {
      const csv = generateCSV(licenses);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=licenses_${season}.csv`);
      return res.send(csv);
    }

    res.json({
      success: true,
      data: { licenses, season }
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// HELPERS
// =====================================================

function getCurrentSeason() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  // La saison commence en août (mois 7)
  if (month >= 7) {
    return `${year}-${year + 1}`;
  }
  return `${year - 1}-${year}`;
}

function generateCSV(data) {
  if (!data.length) return '';

  const headers = Object.keys(data[0]);
  const rows = data.map(row =>
    headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    }).join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

module.exports = router;
