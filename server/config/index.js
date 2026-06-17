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

  // Application (URL publique pour les liens dans les emails)
  app: {
    publicUrl: process.env.PUBLIC_URL || `http://localhost:${parseInt(process.env.PORT, 10) || 3000}`
  },

  // Email (nodemailer). Si email.enabled est faux, on utilise un transport
  // "stub" en dev (jsonTransport) : les emails sont loggués, pas envoyés.
  email: {
    enabled: process.env.EMAIL_ENABLED === 'true',
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.EMAIL_FROM || 'Magny FC 78 <no-reply@magnyfc78.fr>'
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
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
  }
};

// Validation des variables critiques en production
if (config.isProduction) {
  const requiredVars = ['JWT_SECRET', 'DB_PASSWORD', 'SESSION_SECRET'];
  const missing = requiredVars.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(`Variables d'environnement manquantes en production: ${missing.join(', ')}`);
  }

  if (config.jwt.secret && config.jwt.secret.length < 32) {
    throw new Error('JWT_SECRET doit contenir au moins 32 caractères en production');
  }
}

module.exports = config;
