/**
 * Routes d'authentification pour les comptes membres
 * Inscription, connexion, vérification email, reset password
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../config/database');
const config = require('../config');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { sendEmail } = require('../utils/email');
const {
  generateMemberAccessToken,
  generateMemberRefreshToken,
  generateVerificationToken,
  protectMember,
  logMemberActivity
} = require('../middleware/memberAuth');

const router = express.Router();

// =====================================================
// POST /api/member/auth/register - Inscription membre
// =====================================================
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;

    // Validation basique
    if (!email || !password || !firstName || !lastName) {
      throw new AppError('Tous les champs obligatoires doivent être remplis.', 400);
    }

    // Validation email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new AppError('Adresse email invalide.', 400);
    }

    // Validation mot de passe
    if (password.length < 8) {
      throw new AppError('Le mot de passe doit contenir au moins 8 caractères.', 400);
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
    if (!passwordRegex.test(password)) {
      throw new AppError('Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre.', 400);
    }

    // Vérifier si l'email existe déjà
    const [existing] = await db.pool.execute(
      'SELECT id FROM member_accounts WHERE email = ?',
      [email.toLowerCase()]
    );

    if (existing.length) {
      throw new AppError('Cette adresse email est déjà utilisée.', 400);
    }

    // Hasher le mot de passe
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Générer le token de vérification
    const verificationToken = generateVerificationToken();
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    // Créer le compte
    const [result] = await db.pool.execute(
      `INSERT INTO member_accounts
       (email, password_hash, first_name, last_name, phone, verification_token, verification_token_expires)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [email.toLowerCase(), passwordHash, firstName, lastName, phone || null, verificationToken, tokenExpires]
    );

    const accountId = result.insertId;

    // Envoyer l'email de vérification
    const verificationUrl = `${config.server.baseUrl || 'https://magnyfc78.com'}/espace-membre/verify?token=${verificationToken}`;

    await sendEmail({
      to: email.toLowerCase(),
      subject: '[Magny FC 78] Confirmez votre adresse email',
      text: `
Bienvenue sur l'espace membre du Magny FC 78 !

Pour activer votre compte, veuillez cliquer sur le lien ci-dessous :
${verificationUrl}

Ce lien est valable 24 heures.

Si vous n'avez pas créé de compte, ignorez cet email.

Sportivement,
L'équipe du Magny FC 78
      `,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a2744; color: #fff; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9f9f9; padding: 30px; }
    .button { display: inline-block; background: #dabb81; color: #1a2744; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Bienvenue au Magny FC 78 !</h1>
    </div>
    <div class="content">
      <p>Bonjour ${firstName},</p>
      <p>Merci de vous être inscrit sur l'espace membre du Magny FC 78.</p>
      <p>Pour activer votre compte et accéder à toutes les fonctionnalités, veuillez confirmer votre adresse email :</p>
      <p style="text-align: center;">
        <a href="${verificationUrl}" class="button">Confirmer mon email</a>
      </p>
      <p><small>Ce lien est valable 24 heures.</small></p>
      <p>Une fois votre email confirmé, vous pourrez rattacher vos licences et celles de vos enfants à votre compte.</p>
    </div>
    <div class="footer">
      <p>Sportivement,<br>L'équipe du Magny FC 78</p>
      <p><small>Si vous n'avez pas créé de compte, ignorez cet email.</small></p>
    </div>
  </div>
</body>
</html>
      `
    });

    // Log l'activité
    await logMemberActivity(accountId, null, 'register', { email }, req);

    logger.info(`Nouveau compte membre inscrit: ${email}`);

    res.status(201).json({
      success: true,
      message: 'Compte créé avec succès. Veuillez vérifier votre email pour activer votre compte.',
      data: {
        email: email.toLowerCase(),
        requiresVerification: true
      }
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// POST /api/member/auth/verify-email - Vérification email
// =====================================================
router.post('/verify-email', async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      throw new AppError('Token de vérification manquant.', 400);
    }

    // Trouver le compte avec ce token
    const [accounts] = await db.pool.execute(
      `SELECT id, email, first_name, is_verified, verification_token_expires
       FROM member_accounts
       WHERE verification_token = ?`,
      [token]
    );

    if (!accounts.length) {
      throw new AppError('Token de vérification invalide.', 400);
    }

    const account = accounts[0];

    // Vérifier si déjà vérifié
    if (account.is_verified) {
      return res.json({
        success: true,
        message: 'Votre email est déjà vérifié.',
        data: { alreadyVerified: true }
      });
    }

    // Vérifier l'expiration
    if (new Date(account.verification_token_expires) < new Date()) {
      throw new AppError('Le lien de vérification a expiré. Veuillez demander un nouveau lien.', 400);
    }

    // Activer le compte
    await db.pool.execute(
      `UPDATE member_accounts
       SET is_verified = TRUE, verified_at = NOW(), verification_token = NULL, verification_token_expires = NULL
       WHERE id = ?`,
      [account.id]
    );

    await logMemberActivity(account.id, null, 'email_verified', {}, req);

    logger.info(`Email vérifié pour: ${account.email}`);

    res.json({
      success: true,
      message: 'Votre email a été vérifié avec succès. Vous pouvez maintenant vous connecter.',
      data: { verified: true }
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// POST /api/member/auth/resend-verification - Renvoyer email
// =====================================================
router.post('/resend-verification', async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      throw new AppError('Email requis.', 400);
    }

    const [accounts] = await db.pool.execute(
      'SELECT id, email, first_name, is_verified FROM member_accounts WHERE email = ?',
      [email.toLowerCase()]
    );

    if (!accounts.length) {
      // Ne pas révéler si l'email existe ou non
      return res.json({
        success: true,
        message: 'Si cette adresse email est enregistrée, un email de vérification a été envoyé.'
      });
    }

    const account = accounts[0];

    if (account.is_verified) {
      throw new AppError('Cet email est déjà vérifié.', 400);
    }

    // Nouveau token
    const verificationToken = generateVerificationToken();
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.pool.execute(
      'UPDATE member_accounts SET verification_token = ?, verification_token_expires = ? WHERE id = ?',
      [verificationToken, tokenExpires, account.id]
    );

    // Envoyer l'email
    const verificationUrl = `${config.server.baseUrl || 'https://magnyfc78.com'}/espace-membre/verify?token=${verificationToken}`;

    await sendEmail({
      to: account.email,
      subject: '[Magny FC 78] Confirmez votre adresse email',
      text: `Cliquez sur ce lien pour vérifier votre email : ${verificationUrl}`,
      html: `<p>Cliquez <a href="${verificationUrl}">ici</a> pour vérifier votre email.</p>`
    });

    res.json({
      success: true,
      message: 'Si cette adresse email est enregistrée, un email de vérification a été envoyé.'
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// POST /api/member/auth/login - Connexion membre
// =====================================================
router.post('/login', async (req, res, next) => {
  try {
    const { email, password, rememberMe } = req.body;

    if (!email || !password) {
      throw new AppError('Email et mot de passe requis.', 400);
    }

    // Récupérer le compte
    const [accounts] = await db.pool.execute(
      `SELECT id, email, password_hash, first_name, last_name, role, is_active, is_verified,
              failed_login_count, locked_until
       FROM member_accounts WHERE email = ?`,
      [email.toLowerCase()]
    );

    if (!accounts.length) {
      throw new AppError('Email ou mot de passe incorrect.', 401);
    }

    const account = accounts[0];

    // Vérifier si le compte est verrouillé
    if (account.locked_until && new Date(account.locked_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(account.locked_until) - new Date()) / 60000);
      throw new AppError(`Compte verrouillé. Réessayez dans ${minutesLeft} minutes.`, 401);
    }

    // Vérifier si le compte est actif
    if (!account.is_active) {
      throw new AppError('Ce compte a été désactivé. Contactez le club.', 401);
    }

    // Vérifier le mot de passe
    const isValid = await bcrypt.compare(password, account.password_hash);

    if (!isValid) {
      // Incrémenter le compteur d'échecs
      const newFailCount = (account.failed_login_count || 0) + 1;
      let lockUntil = null;

      // Verrouiller après 5 tentatives (15 minutes)
      if (newFailCount >= 5) {
        lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      }

      await db.pool.execute(
        'UPDATE member_accounts SET failed_login_count = ?, locked_until = ? WHERE id = ?',
        [newFailCount, lockUntil, account.id]
      );

      if (lockUntil) {
        throw new AppError('Trop de tentatives. Compte verrouillé pour 15 minutes.', 401);
      }

      throw new AppError('Email ou mot de passe incorrect.', 401);
    }

    // Connexion réussie - réinitialiser les compteurs
    await db.pool.execute(
      `UPDATE member_accounts
       SET failed_login_count = 0, locked_until = NULL, last_login = NOW(), login_count = login_count + 1
       WHERE id = ?`,
      [account.id]
    );

    // Générer les tokens
    const accessToken = generateMemberAccessToken(account.id, account.role);
    const refreshToken = generateMemberRefreshToken(account.id);

    // Stocker la session
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const sessionExpires = new Date(Date.now() + (rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000);

    await db.pool.execute(
      `INSERT INTO member_sessions (account_id, token_hash, device_info, ip_address, user_agent, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        account.id,
        tokenHash,
        req.get('User-Agent')?.substring(0, 100) || 'Unknown',
        req.ip || req.connection.remoteAddress,
        req.get('User-Agent'),
        sessionExpires
      ]
    );

    // Cookie pour le refresh token
    res.cookie('memberRefreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: (rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000
    });

    await logMemberActivity(account.id, null, 'login', { rememberMe }, req);

    logger.info(`Connexion membre: ${account.email}`);

    // Récupérer les licences associées
    const [licenses] = await db.pool.execute(
      `SELECT l.id, l.license_number, l.first_name, l.last_name, l.category, l.photo_url,
              al.relationship, al.is_primary
       FROM licenses l
       JOIN account_licenses al ON l.id = al.license_id
       WHERE al.account_id = ? AND l.is_active = TRUE
       ORDER BY al.is_primary DESC`,
      [account.id]
    );

    res.json({
      success: true,
      message: 'Connexion réussie',
      data: {
        account: {
          id: account.id,
          email: account.email,
          firstName: account.first_name,
          lastName: account.last_name,
          fullName: `${account.first_name} ${account.last_name}`,
          role: account.role,
          isVerified: account.is_verified
        },
        licenses: licenses.map(l => ({
          id: l.id,
          licenseNumber: l.license_number,
          firstName: l.first_name,
          lastName: l.last_name,
          fullName: `${l.first_name} ${l.last_name}`,
          category: l.category,
          photoUrl: l.photo_url,
          relationship: l.relationship,
          isPrimary: l.is_primary
        })),
        accessToken,
        requiresVerification: !account.is_verified
      }
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// POST /api/member/auth/logout - Déconnexion
// =====================================================
router.post('/logout', protectMember, async (req, res, next) => {
  try {
    const refreshToken = req.cookies.memberRefreshToken;

    if (refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await db.pool.execute(
        'UPDATE member_sessions SET is_active = FALSE WHERE token_hash = ?',
        [tokenHash]
      );
    }

    await logMemberActivity(req.member.id, null, 'logout', {}, req);

    // Supprimer les cookies
    res.cookie('memberRefreshToken', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: new Date(0)
    });

    res.cookie('memberToken', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: new Date(0)
    });

    res.json({
      success: true,
      message: 'Déconnexion réussie'
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// POST /api/member/auth/refresh - Rafraîchir le token
// =====================================================
router.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = req.cookies.memberRefreshToken;

    if (!refreshToken) {
      throw new AppError('Token de rafraîchissement manquant.', 401);
    }

    // Vérifier le token
    let decoded;
    try {
      decoded = require('jsonwebtoken').verify(refreshToken, config.jwt.refreshSecret);
    } catch (err) {
      throw new AppError('Token invalide ou expiré.', 401);
    }

    if (decoded.type !== 'member') {
      throw new AppError('Token invalide.', 401);
    }

    // Vérifier la session
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const [sessions] = await db.pool.execute(
      'SELECT * FROM member_sessions WHERE token_hash = ? AND is_active = TRUE AND expires_at > NOW()',
      [tokenHash]
    );

    if (!sessions.length) {
      throw new AppError('Session invalide ou expirée.', 401);
    }

    // Vérifier le compte
    const [accounts] = await db.pool.execute(
      'SELECT id, role, is_active FROM member_accounts WHERE id = ?',
      [decoded.id]
    );

    if (!accounts.length || !accounts[0].is_active) {
      throw new AppError('Compte non trouvé ou désactivé.', 401);
    }

    // Mettre à jour l'activité de la session
    await db.pool.execute(
      'UPDATE member_sessions SET last_activity = NOW() WHERE id = ?',
      [sessions[0].id]
    );

    // Générer un nouveau access token
    const accessToken = generateMemberAccessToken(accounts[0].id, accounts[0].role);

    res.json({
      success: true,
      data: { accessToken }
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// POST /api/member/auth/forgot-password - Mot de passe oublié
// =====================================================
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      throw new AppError('Email requis.', 400);
    }

    // Message générique pour éviter l'énumération des comptes
    const genericMessage = 'Si cette adresse email est enregistrée, vous recevrez un email avec les instructions.';

    const [accounts] = await db.pool.execute(
      'SELECT id, email, first_name FROM member_accounts WHERE email = ? AND is_active = TRUE',
      [email.toLowerCase()]
    );

    if (!accounts.length) {
      return res.json({ success: true, message: genericMessage });
    }

    const account = accounts[0];

    // Générer le token de reset
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 heure

    await db.pool.execute(
      'UPDATE member_accounts SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
      [resetTokenHash, resetExpires, account.id]
    );

    // Envoyer l'email
    const resetUrl = `${config.server.baseUrl || 'https://magnyfc78.com'}/espace-membre/reset-password?token=${resetToken}`;

    await sendEmail({
      to: account.email,
      subject: '[Magny FC 78] Réinitialisation de votre mot de passe',
      text: `
Bonjour ${account.first_name},

Vous avez demandé la réinitialisation de votre mot de passe.

Cliquez sur ce lien pour créer un nouveau mot de passe :
${resetUrl}

Ce lien est valable 1 heure.

Si vous n'avez pas fait cette demande, ignorez cet email.

Sportivement,
L'équipe du Magny FC 78
      `,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a2744; color: #fff; padding: 30px; text-align: center; }
    .content { background: #f9f9f9; padding: 30px; }
    .button { display: inline-block; background: #dabb81; color: #1a2744; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Réinitialisation du mot de passe</h1>
    </div>
    <div class="content">
      <p>Bonjour ${account.first_name},</p>
      <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" class="button">Créer un nouveau mot de passe</a>
      </p>
      <p><small>Ce lien est valable 1 heure.</small></p>
    </div>
    <div class="footer">
      <p>Si vous n'avez pas fait cette demande, ignorez cet email.</p>
    </div>
  </div>
</body>
</html>
      `
    });

    await logMemberActivity(account.id, null, 'password_reset_requested', {}, req);

    res.json({ success: true, message: genericMessage });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// POST /api/member/auth/reset-password - Reset mot de passe
// =====================================================
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      throw new AppError('Token et mot de passe requis.', 400);
    }

    // Validation mot de passe
    if (password.length < 8) {
      throw new AppError('Le mot de passe doit contenir au moins 8 caractères.', 400);
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
    if (!passwordRegex.test(password)) {
      throw new AppError('Le mot de passe doit contenir une majuscule, une minuscule et un chiffre.', 400);
    }

    // Hasher le token pour comparaison
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Trouver le compte
    const [accounts] = await db.pool.execute(
      `SELECT id, email FROM member_accounts
       WHERE reset_token = ? AND reset_token_expires > NOW() AND is_active = TRUE`,
      [resetTokenHash]
    );

    if (!accounts.length) {
      throw new AppError('Token invalide ou expiré.', 400);
    }

    const account = accounts[0];

    // Hasher le nouveau mot de passe
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Mettre à jour le mot de passe et effacer le token
    await db.pool.execute(
      `UPDATE member_accounts
       SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL,
           failed_login_count = 0, locked_until = NULL
       WHERE id = ?`,
      [passwordHash, account.id]
    );

    // Invalider toutes les sessions existantes
    await db.pool.execute(
      'UPDATE member_sessions SET is_active = FALSE WHERE account_id = ?',
      [account.id]
    );

    await logMemberActivity(account.id, null, 'password_reset_completed', {}, req);

    logger.info(`Mot de passe réinitialisé pour: ${account.email}`);

    res.json({
      success: true,
      message: 'Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.'
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// GET /api/member/auth/me - Infos compte connecté
// =====================================================
router.get('/me', protectMember, async (req, res) => {
  res.json({
    success: true,
    data: {
      account: {
        id: req.member.id,
        email: req.member.email,
        firstName: req.member.firstName,
        lastName: req.member.lastName,
        fullName: req.member.fullName,
        role: req.member.role,
        isVerified: req.member.isVerified
      },
      licenses: req.member.licenses
    }
  });
});

// =====================================================
// GET /api/member/auth/sessions - Sessions actives
// =====================================================
router.get('/sessions', protectMember, async (req, res, next) => {
  try {
    const [sessions] = await db.pool.execute(
      `SELECT id, device_info, ip_address, last_activity, created_at
       FROM member_sessions
       WHERE account_id = ? AND is_active = TRUE AND expires_at > NOW()
       ORDER BY last_activity DESC`,
      [req.member.id]
    );

    res.json({
      success: true,
      data: { sessions }
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// DELETE /api/member/auth/sessions/:id - Révoquer session
// =====================================================
router.delete('/sessions/:id', protectMember, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Vérifier que la session appartient au membre
    const [sessions] = await db.pool.execute(
      'SELECT id FROM member_sessions WHERE id = ? AND account_id = ?',
      [id, req.member.id]
    );

    if (!sessions.length) {
      throw new AppError('Session non trouvée.', 404);
    }

    await db.pool.execute(
      'UPDATE member_sessions SET is_active = FALSE WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Session révoquée.'
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
