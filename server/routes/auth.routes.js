/**
 * Routes d'authentification sécurisées
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const config = require('../config');
const { generateAccessToken, generateRefreshToken, protect } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validator');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

// =====================================================
// POST /api/auth/register - Inscription
// =====================================================
router.post('/register', validate(schemas.register), async (req, res, next) => {
  try {
    const { nom, email, password } = req.body;

    // Vérifier si l'email existe déjà
    const existing = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) {
      throw new AppError('Cet email est déjà utilisé.', 400);
    }

    // Hasher le mot de passe
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Créer l'utilisateur
    const result = await db.query(
      `INSERT INTO users (id, nom, email, password, role, actif, created_at) 
       VALUES (?, ?, ?, ?, 'user', 1, NOW())`,
      [uuidv4(), nom, email.toLowerCase(), hashedPassword]
    );

    // Générer les tokens
    const accessToken = generateAccessToken(result.insertId, 'user');
    const refreshToken = generateRefreshToken(result.insertId);

    // Envoyer le refresh token en cookie HttpOnly
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 jours
    });

    logger.info(`Nouvel utilisateur inscrit: ${email}`);

    res.status(201).json({
      success: true,
      message: 'Inscription réussie',
      data: {
        user: { nom, email, role: 'user' },
        accessToken
      }
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// POST /api/auth/login - Connexion
// =====================================================
router.post('/login', validate(schemas.login), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Récupérer l'utilisateur
    const users = await db.query(
      'SELECT id, nom, email, password, role, actif FROM users WHERE email = ?',
      [email.toLowerCase()]
    );

    if (!users.length) {
      throw new AppError('Email ou mot de passe incorrect.', 401);
    }

    const user = users[0];

    // Vérifier si le compte est actif
    if (!user.actif) {
      throw new AppError('Ce compte a été désactivé.', 401);
    }

    // Vérifier le mot de passe
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      logger.warn(`Tentative de connexion échouée pour: ${email}`);
      throw new AppError('Email ou mot de passe incorrect.', 401);
    }

    // Générer les tokens
    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id);

    // Mettre à jour la dernière connexion
    await db.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    // Cookie HttpOnly pour le refresh token
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    logger.info(`Connexion réussie: ${email}`);

    res.json({
      success: true,
      message: 'Connexion réussie',
      data: {
        user: {
          id: user.id,
          nom: user.nom,
          email: user.email,
          role: user.role
        },
        accessToken
      }
    });

  } catch (error) {
    next(error);
  }
});

// =====================================================
// POST /api/auth/logout - Déconnexion
// =====================================================
router.post('/logout', (req, res) => {
  res.cookie('refreshToken', '', {
    httpOnly: true,
    expires: new Date(0)
  });
  res.cookie('jwt', '', {
    httpOnly: true,
    expires: new Date(0)
  });

  res.json({
    success: true,
    message: 'Déconnexion réussie'
  });
});

// =====================================================
// GET /api/auth/me - Utilisateur courant
// =====================================================
router.get('/me', protect, async (req, res) => {
  res.json({
    success: true,
    data: {
      user: req.user
    }
  });
});

// =====================================================
// POST /api/auth/refresh - Rafraîchir le token
// =====================================================
router.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    
    if (!refreshToken) {
      throw new AppError('Token de rafraîchissement manquant.', 401);
    }

    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);

    const users = await db.query(
      'SELECT id, role FROM users WHERE id = ? AND actif = 1',
      [decoded.id]
    );

    if (!users.length) {
      throw new AppError('Utilisateur non trouvé.', 401);
    }

    const accessToken = generateAccessToken(users[0].id, users[0].role);

    res.json({
      success: true,
      data: { accessToken }
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
