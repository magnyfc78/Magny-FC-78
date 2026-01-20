/**
 * Routes de gestion du profil pour les membres
 * Modification des informations personnelles, mot de passe, préférences
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { protectMember, logMemberActivity } = require('../middleware/memberAuth');

const router = express.Router();

// Toutes les routes nécessitent une authentification membre
router.use(protectMember);

// =====================================================
// GET /api/member/profile - Mon profil complet
// =====================================================
router.get('/', async (req, res, next) => {
  try {
    const [accounts] = await db.pool.execute(
      `SELECT
        id, email, first_name, last_name, phone, avatar_url, role,
        is_verified, verified_at,
        notify_email, notify_match, notify_training, notify_news,
        last_login, login_count, created_at
       FROM member_accounts WHERE id = ?`,
      [req.member.id]
    );

    if (!accounts.length) {
      throw new AppError('Compte non trouvé.', 404);
    }

    const account = accounts[0];

    res.json({
      success: true,
      data: {
        profile: {
          id: account.id,
          email: account.email,
          firstName: account.first_name,
          lastName: account.last_name,
          fullName: `${account.first_name} ${account.last_name}`,
          phone: account.phone,
          avatarUrl: account.avatar_url,
          role: account.role,
          isVerified: account.is_verified,
          verifiedAt: account.verified_at,
          notifications: {
            email: account.notify_email,
            match: account.notify_match,
            training: account.notify_training,
            news: account.notify_news
          },
          stats: {
            lastLogin: account.last_login,
            loginCount: account.login_count,
            memberSince: account.created_at
          }
        },
        licenses: req.member.licenses
      }
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// PATCH /api/member/profile - Modifier mon profil
// =====================================================
router.patch('/', async (req, res, next) => {
  try {
    const { firstName, lastName, phone } = req.body;

    // Validation basique
    if (firstName !== undefined && firstName.length < 2) {
      throw new AppError('Le prénom doit contenir au moins 2 caractères.', 400);
    }
    if (lastName !== undefined && lastName.length < 2) {
      throw new AppError('Le nom doit contenir au moins 2 caractères.', 400);
    }

    // Construire la mise à jour
    const updates = [];
    const values = [];

    if (firstName !== undefined) {
      updates.push('first_name = ?');
      values.push(firstName);
    }
    if (lastName !== undefined) {
      updates.push('last_name = ?');
      values.push(lastName);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      values.push(phone || null);
    }

    if (updates.length === 0) {
      throw new AppError('Aucune modification fournie.', 400);
    }

    values.push(req.member.id);

    await db.pool.execute(
      `UPDATE member_accounts SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    await logMemberActivity(req.member.id, null, 'profile_updated', { firstName, lastName, phone }, req);

    res.json({
      success: true,
      message: 'Profil mis à jour avec succès.'
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// PUT /api/member/profile/password - Changer mot de passe
// =====================================================
router.put('/password', async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword) {
      throw new AppError('Mot de passe actuel et nouveau mot de passe requis.', 400);
    }

    if (newPassword !== confirmPassword) {
      throw new AppError('Les nouveaux mots de passe ne correspondent pas.', 400);
    }

    if (newPassword.length < 8) {
      throw new AppError('Le nouveau mot de passe doit contenir au moins 8 caractères.', 400);
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
    if (!passwordRegex.test(newPassword)) {
      throw new AppError('Le mot de passe doit contenir une majuscule, une minuscule et un chiffre.', 400);
    }

    // Récupérer le hash actuel
    const [accounts] = await db.pool.execute(
      'SELECT password_hash FROM member_accounts WHERE id = ?',
      [req.member.id]
    );

    // Vérifier le mot de passe actuel
    const isValid = await bcrypt.compare(currentPassword, accounts[0].password_hash);
    if (!isValid) {
      throw new AppError('Mot de passe actuel incorrect.', 401);
    }

    // Hasher le nouveau mot de passe
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Mettre à jour
    await db.pool.execute(
      'UPDATE member_accounts SET password_hash = ? WHERE id = ?',
      [newPasswordHash, req.member.id]
    );

    await logMemberActivity(req.member.id, null, 'password_changed', {}, req);

    logger.info(`Mot de passe changé pour: ${req.member.email}`);

    res.json({
      success: true,
      message: 'Mot de passe modifié avec succès.'
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// PUT /api/member/profile/email - Changer email
// =====================================================
router.put('/email', async (req, res, next) => {
  try {
    const { newEmail, password } = req.body;

    if (!newEmail || !password) {
      throw new AppError('Nouvel email et mot de passe requis.', 400);
    }

    // Validation email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      throw new AppError('Adresse email invalide.', 400);
    }

    // Vérifier si l'email n'est pas déjà utilisé
    const [existing] = await db.pool.execute(
      'SELECT id FROM member_accounts WHERE email = ? AND id != ?',
      [newEmail.toLowerCase(), req.member.id]
    );

    if (existing.length) {
      throw new AppError('Cette adresse email est déjà utilisée.', 400);
    }

    // Vérifier le mot de passe
    const [accounts] = await db.pool.execute(
      'SELECT password_hash FROM member_accounts WHERE id = ?',
      [req.member.id]
    );

    const isValid = await bcrypt.compare(password, accounts[0].password_hash);
    if (!isValid) {
      throw new AppError('Mot de passe incorrect.', 401);
    }

    // Générer un token de vérification pour le nouvel email
    const { generateVerificationToken } = require('../middleware/memberAuth');
    const verificationToken = generateVerificationToken();
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Stocker temporairement le nouvel email
    await db.pool.execute(
      `UPDATE member_accounts
       SET verification_token = ?, verification_token_expires = ?
       WHERE id = ?`,
      [verificationToken, tokenExpires, req.member.id]
    );

    // Envoyer l'email de vérification au nouvel email
    const { sendEmail } = require('../utils/email');
    const config = require('../config');
    const verificationUrl = `${config.server.baseUrl || 'https://magnyfc78.com'}/espace-membre/verify-new-email?token=${verificationToken}&email=${encodeURIComponent(newEmail.toLowerCase())}`;

    await sendEmail({
      to: newEmail.toLowerCase(),
      subject: '[Magny FC 78] Confirmez votre nouvelle adresse email',
      text: `Cliquez sur ce lien pour confirmer votre nouvelle adresse email : ${verificationUrl}`,
      html: `
<p>Bonjour,</p>
<p>Vous avez demandé à changer votre adresse email sur l'espace membre du Magny FC 78.</p>
<p><a href="${verificationUrl}">Cliquez ici pour confirmer votre nouvelle adresse email</a></p>
<p>Ce lien est valable 24 heures.</p>
      `
    });

    await logMemberActivity(req.member.id, null, 'email_change_requested', { newEmail }, req);

    res.json({
      success: true,
      message: 'Un email de confirmation a été envoyé à votre nouvelle adresse.'
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// PUT /api/member/profile/notifications - Préférences notifications
// =====================================================
router.put('/notifications', async (req, res, next) => {
  try {
    const { email, match, training, news } = req.body;

    const updates = [];
    const values = [];

    if (email !== undefined) {
      updates.push('notify_email = ?');
      values.push(email ? 1 : 0);
    }
    if (match !== undefined) {
      updates.push('notify_match = ?');
      values.push(match ? 1 : 0);
    }
    if (training !== undefined) {
      updates.push('notify_training = ?');
      values.push(training ? 1 : 0);
    }
    if (news !== undefined) {
      updates.push('notify_news = ?');
      values.push(news ? 1 : 0);
    }

    if (updates.length === 0) {
      throw new AppError('Aucune préférence fournie.', 400);
    }

    values.push(req.member.id);

    await db.pool.execute(
      `UPDATE member_accounts SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    res.json({
      success: true,
      message: 'Préférences de notification mises à jour.'
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// DELETE /api/member/profile - Supprimer mon compte
// =====================================================
router.delete('/', async (req, res, next) => {
  try {
    const { password, confirmation } = req.body;

    if (!password) {
      throw new AppError('Mot de passe requis pour confirmer la suppression.', 400);
    }

    if (confirmation !== 'SUPPRIMER MON COMPTE') {
      throw new AppError('Veuillez confirmer la suppression en tapant "SUPPRIMER MON COMPTE".', 400);
    }

    // Vérifier le mot de passe
    const [accounts] = await db.pool.execute(
      'SELECT password_hash FROM member_accounts WHERE id = ?',
      [req.member.id]
    );

    const isValid = await bcrypt.compare(password, accounts[0].password_hash);
    if (!isValid) {
      throw new AppError('Mot de passe incorrect.', 401);
    }

    // Log avant suppression
    await logMemberActivity(req.member.id, null, 'account_deleted', {}, req);

    // Supprimer le compte (les liaisons account_licenses seront supprimées en cascade)
    await db.pool.execute(
      'DELETE FROM member_accounts WHERE id = ?',
      [req.member.id]
    );

    logger.info(`Compte membre supprimé: ${req.member.email}`);

    // Supprimer les cookies
    res.cookie('memberRefreshToken', '', { expires: new Date(0) });
    res.cookie('memberToken', '', { expires: new Date(0) });

    res.json({
      success: true,
      message: 'Votre compte a été supprimé définitivement.'
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// GET /api/member/profile/activity - Historique d'activité
// =====================================================
router.get('/activity', async (req, res, next) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const [logs] = await db.pool.execute(
      `SELECT
        mal.action,
        mal.details,
        mal.created_at,
        l.first_name as license_first_name,
        l.last_name as license_last_name
       FROM member_activity_logs mal
       LEFT JOIN licenses l ON mal.license_id = l.id
       WHERE mal.account_id = ?
       ORDER BY mal.created_at DESC
       LIMIT ? OFFSET ?`,
      [req.member.id, parseInt(limit), parseInt(offset)]
    );

    // Traduire les actions
    const actionLabels = {
      'login': 'Connexion',
      'logout': 'Déconnexion',
      'register': 'Création du compte',
      'email_verified': 'Email vérifié',
      'password_changed': 'Mot de passe modifié',
      'password_reset_requested': 'Réinitialisation demandée',
      'password_reset_completed': 'Mot de passe réinitialisé',
      'profile_updated': 'Profil modifié',
      'license_linked': 'Licence rattachée',
      'license_unlinked': 'Licence détachée',
      'license_updated': 'Licence modifiée',
      'license_link_requested': 'Demande de rattachement'
    };

    const formattedLogs = logs.map(log => ({
      action: log.action,
      label: actionLabels[log.action] || log.action,
      details: log.details ? JSON.parse(log.details) : null,
      license: log.license_first_name ? `${log.license_first_name} ${log.license_last_name}` : null,
      date: log.created_at
    }));

    res.json({
      success: true,
      data: {
        activities: formattedLogs
      }
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
