/**
 * Middleware d'authentification pour les comptes membres
 * Séparé de l'auth admin pour une meilleure gestion
 */

const jwt = require('jsonwebtoken');
const db = require('../config/database');
const config = require('../config');
const logger = require('../utils/logger');

// Générer un Access Token pour membre
const generateMemberAccessToken = (accountId, role = 'member') => {
  if (!config.jwt.secret) {
    throw new Error('JWT_SECRET non configuré');
  }
  return jwt.sign(
    { id: accountId, role, type: 'member' },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
};

// Générer un Refresh Token pour membre
const generateMemberRefreshToken = (accountId) => {
  if (!config.jwt.refreshSecret) {
    throw new Error('REFRESH_TOKEN_SECRET non configuré');
  }
  return jwt.sign(
    { id: accountId, type: 'member' },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );
};

// Générer un token de vérification email
const generateVerificationToken = () => {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
};

// Générer un code d'invitation (8 caractères alphanumériques)
const generateInvitationCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sans I, O, 0, 1 pour éviter confusion
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Middleware de protection des routes membres
const protectMember = async (req, res, next) => {
  try {
    let token;

    // 1. Récupérer le token (Header ou Cookie)
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.memberToken) {
      token = req.cookies.memberToken;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Accès non autorisé. Veuillez vous connecter à votre espace membre.'
      });
    }

    // 2. Vérifier le token
    const decoded = jwt.verify(token, config.jwt.secret);

    // Vérifier que c'est un token membre
    if (decoded.type !== 'member') {
      return res.status(401).json({
        success: false,
        error: 'Token invalide pour l\'espace membre.'
      });
    }

    // 3. Vérifier que le compte existe et est actif
    const [accounts] = await db.pool.execute(
      `SELECT id, email, first_name, last_name, role, is_active, is_verified, locked_until
       FROM member_accounts WHERE id = ?`,
      [decoded.id]
    );

    if (!accounts.length) {
      return res.status(401).json({
        success: false,
        error: 'Compte non trouvé.'
      });
    }

    const account = accounts[0];

    // Vérifier si le compte est actif
    if (!account.is_active) {
      return res.status(401).json({
        success: false,
        error: 'Ce compte a été désactivé.'
      });
    }

    // Vérifier si le compte est verrouillé
    if (account.locked_until && new Date(account.locked_until) > new Date()) {
      return res.status(401).json({
        success: false,
        error: 'Compte temporairement verrouillé. Réessayez plus tard.'
      });
    }

    // Vérifier si l'email est vérifié
    if (!account.is_verified) {
      return res.status(403).json({
        success: false,
        error: 'Veuillez vérifier votre adresse email pour accéder à cette fonctionnalité.',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }

    // 4. Récupérer les licences associées
    const [licenses] = await db.pool.execute(
      `SELECT l.*, al.relationship, al.is_primary, al.can_manage
       FROM licenses l
       JOIN account_licenses al ON l.id = al.license_id
       WHERE al.account_id = ? AND l.is_active = TRUE
       ORDER BY al.is_primary DESC, l.first_name`,
      [account.id]
    );

    // 5. Attacher les infos à la requête
    req.member = {
      id: account.id,
      email: account.email,
      firstName: account.first_name,
      lastName: account.last_name,
      fullName: `${account.first_name} ${account.last_name}`,
      role: account.role,
      isVerified: account.is_verified,
      licenses: licenses.map(l => ({
        id: l.id,
        licenseNumber: l.license_number,
        firstName: l.first_name,
        lastName: l.last_name,
        fullName: `${l.first_name} ${l.last_name}`,
        birthDate: l.birth_date,
        category: l.category,
        teamId: l.team_id,
        relationship: l.relationship,
        isPrimary: l.is_primary,
        canManage: l.can_manage
      }))
    };

    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Token invalide.'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Session expirée. Veuillez vous reconnecter.',
        code: 'TOKEN_EXPIRED'
      });
    }
    logger.error('Erreur auth membre middleware:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur d\'authentification.'
    });
  }
};

// Middleware optionnel - ne bloque pas si pas de token
const optionalMemberAuth = async (req, res, next) => {
  try {
    let token = req.headers.authorization?.split(' ')[1] || req.cookies?.memberToken;

    if (token) {
      const decoded = jwt.verify(token, config.jwt.secret);

      if (decoded.type === 'member') {
        const [accounts] = await db.pool.execute(
          'SELECT id, email, first_name, last_name, role FROM member_accounts WHERE id = ? AND is_active = TRUE',
          [decoded.id]
        );

        if (accounts.length) {
          req.member = accounts[0];
        }
      }
    }
  } catch (error) {
    // Ignorer les erreurs, continuer sans auth
  }
  next();
};

// Middleware de restriction par rôle membre
const restrictMemberTo = (...roles) => {
  return (req, res, next) => {
    if (!req.member) {
      return res.status(401).json({
        success: false,
        error: 'Authentification requise.'
      });
    }

    if (!roles.includes(req.member.role)) {
      return res.status(403).json({
        success: false,
        error: 'Vous n\'avez pas la permission d\'effectuer cette action.'
      });
    }
    next();
  };
};

// Vérifier si l'utilisateur peut gérer une licence spécifique
const canManageLicense = (req, res, next) => {
  const licenseId = parseInt(req.params.licenseId || req.body.license_id);

  if (!licenseId) {
    return res.status(400).json({
      success: false,
      error: 'ID de licence requis.'
    });
  }

  const license = req.member.licenses.find(l => l.id === licenseId);

  if (!license) {
    return res.status(403).json({
      success: false,
      error: 'Vous n\'avez pas accès à cette licence.'
    });
  }

  if (!license.canManage) {
    return res.status(403).json({
      success: false,
      error: 'Vous n\'avez pas les droits de modification sur cette licence.'
    });
  }

  req.currentLicense = license;
  next();
};

// Logger une activité membre
const logMemberActivity = async (accountId, licenseId, action, details, req) => {
  try {
    await db.pool.execute(
      `INSERT INTO member_activity_logs (account_id, license_id, action, details, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        accountId,
        licenseId,
        action,
        details ? JSON.stringify(details) : null,
        req?.ip || req?.connection?.remoteAddress || null,
        req?.get('User-Agent') || null
      ]
    );
  } catch (error) {
    logger.error('Erreur log activité membre:', error);
  }
};

module.exports = {
  generateMemberAccessToken,
  generateMemberRefreshToken,
  generateVerificationToken,
  generateInvitationCode,
  protectMember,
  optionalMemberAuth,
  restrictMemberTo,
  canManageLicense,
  logMemberActivity
};
