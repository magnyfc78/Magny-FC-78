/**
 * Routes auth v1 — /api/v1/auth
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { validate } = require('../../../middleware/validator');
const schemas = require('./auth.validator');
const controller = require('./auth.controller');

const router = express.Router();

// Rate limiting ciblé (P5) — vérification de licence/email et tentatives sensibles.
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Trop de tentatives. Réessayez plus tard.' },
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Trop de tentatives. Réessayez dans une heure.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Étape 1 inscription : l'email correspond-il à une licence ?
router.post('/check-email', verifyLimiter, validate(schemas.checkEmail), controller.checkEmail);

// Inscription
router.post('/register', authLimiter, validate(schemas.register), controller.register);
router.post('/register-with-invitation', authLimiter, validate(schemas.registerWithInvitation), controller.registerWithInvitation);

// Connexion
router.post('/login', authLimiter, validate(schemas.login), controller.login);

// Vérification email (token en URL)
router.post('/verify-email/:token', verifyLimiter, controller.verifyEmail);

// Mot de passe oublié / réinitialisation
router.post('/forgot-password', authLimiter, validate(schemas.forgotPassword), controller.forgotPassword);
router.post('/reset-password', authLimiter, validate(schemas.resetPassword), controller.resetPassword);

module.exports = router;
