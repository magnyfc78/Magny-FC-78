/**
 * Middleware d'authentification JWT sécurisé
 */

const jwt = require('jsonwebtoken');
const db = require('../config/database');
const logger = require('../utils/logger');

// Générer un Access Token
const generateAccessToken = (userId, role) => {
  return jwt.sign(
    { id: userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Générer un Refresh Token
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d' }
  );
};

// Middleware de protection des routes
const protect = async (req, res, next) => {
  try {
    let token;

    // 1. Récupérer le token (Header ou Cookie)
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Accès non autorisé. Veuillez vous connecter.'
      });
    }

    // 2. Vérifier le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Vérifier que l'utilisateur existe toujours
    const users = await db.query(
      'SELECT id, email, nom, role, actif FROM users WHERE id = ?',
      [decoded.id]
    );

    if (!users.length || !users[0].actif) {
      return res.status(401).json({
        success: false,
        error: 'Utilisateur non trouvé ou désactivé.'
      });
    }

    // 4. Attacher l'utilisateur à la requête
    req.user = users[0];
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
        error: 'Session expirée. Veuillez vous reconnecter.'
      });
    }
    logger.error('Erreur auth middleware:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur d\'authentification.'
    });
  }
};

// Middleware de restriction par rôle
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Vous n\'avez pas la permission d\'effectuer cette action.'
      });
    }
    next();
  };
};

// Optionnel : Vérifier si connecté sans bloquer
const optionalAuth = async (req, res, next) => {
  try {
    let token = req.headers.authorization?.split(' ')[1] || req.cookies?.jwt;
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const users = await db.query(
        'SELECT id, email, nom, role FROM users WHERE id = ? AND actif = 1',
        [decoded.id]
      );
      if (users.length) {
        req.user = users[0];
      }
    }
  } catch (error) {
    // Ignorer les erreurs, continuer sans auth
  }
  next();
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  protect,
  restrictTo,
  optionalAuth
};
