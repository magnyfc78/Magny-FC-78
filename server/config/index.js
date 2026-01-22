/**
 * Configuration centralisée de l'application
 * Charge automatiquement le bon fichier .env selon NODE_ENV
 */

// Charger les variables d'environnement avec dotenv-flow
// Ordre de chargement: .env.local > .env.[NODE_ENV].local > .env.[NODE_ENV] > .env
require('dotenv-flow').config({
  path: process.cwd(),
  silent: true
});

const config = {
  // Environnement
  env: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  isTest: process.env.NODE_ENV === 'test',

  // Serveur
  server: {
    port: parseInt(process.env.PORT, 10) || 3000,
    host: process.env.HOST || 'localhost'
  },

  // Base de données
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'magny_fc_78'
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.REFRESH_TOKEN_SECRET,
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d'
  },

  // Sécurité
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12
  },

  // Session
  session: {
    secret: process.env.SESSION_SECRET,
    cookieSecure: process.env.COOKIE_SECURE === 'true',
    maxAge: 24 * 60 * 60 * 1000 // 24 heures
  },

  // Logs
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  },

  // Email SMTP
  email: {
    host: process.env.SMTP_HOST || 'ssl0.ovh.net',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.SMTP_FROM || 'contact@magnyfc78.fr',
    contactEmail: process.env.CONTACT_EMAIL || 'contact@magnyfc78.fr'
  }
};

// Validation des variables critiques en production
if (config.isProduction) {
  const requiredVars = ['JWT_SECRET', 'REFRESH_TOKEN_SECRET', 'DB_PASSWORD', 'SESSION_SECRET'];
  const missing = requiredVars.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(`Variables d'environnement manquantes en production: ${missing.join(', ')}`);
  }

  if (config.jwt.secret && config.jwt.secret.length < 32) {
    throw new Error('JWT_SECRET doit contenir au moins 32 caractères en production');
  }

  if (config.jwt.refreshSecret && config.jwt.refreshSecret.length < 32) {
    throw new Error('REFRESH_TOKEN_SECRET doit contenir au moins 32 caractères en production');
  }
}

module.exports = config;
