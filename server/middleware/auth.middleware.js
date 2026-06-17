/**
 * Middlewares d'authentification pour l'API v1.
 * Implémentation autonome (vérif JWT + select enrichi incluant email_verified),
 * pour ne pas dépendre du select restreint du middleware historique.
 */

const jwt = require('jsonwebtoken');
const db = require('../config/database');
const logger = require('../utils/logger');

const extractToken = (req) => {
  if (req.headers.authorization?.startsWith('Bearer')) {
    return req.headers.authorization.split(' ')[1];
  }
  return req.cookies?.jwt || null;
};

/**
 * Authentifie la requête (JWT) et attache req.user (compte non supprimé/actif).
 */
const authenticate = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ success: false, error: 'Authentification requise.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const users = await db.query(
      `SELECT id, nom, prenom, email, role, actif, email_verified
       FROM users
       WHERE id = ? AND deleted_at IS NULL`,
      [decoded.id]
    );

    if (!users.length || !users[0].actif) {
      return res.status(401).json({ success: false, error: 'Compte introuvable ou désactivé.' });
    }

    req.user = users[0];
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, error: 'Token invalide.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Session expirée. Reconnectez-vous.' });
    }
    logger.error('Erreur auth.middleware:', error);
    return res.status(500).json({ success: false, error: 'Erreur d\'authentification.' });
  }
};

/**
 * Exige un email vérifié. À placer APRÈS authenticate.
 */
const requireVerifiedEmail = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentification requise.' });
  }
  if (!req.user.email_verified) {
    return res.status(403).json({
      success: false,
      error: 'Veuillez vérifier votre adresse email pour effectuer cette action.'
    });
  }
  next();
};

module.exports = { authenticate, requireVerifiedEmail };
