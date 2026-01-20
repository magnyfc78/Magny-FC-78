/**
 * MAGNY FC 78 - Configuration Express avec sécurité maximale
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const { createClient } = require('redis');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const xss = require('xss-clean');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const path = require('path');
const config = require('./config');
const logger = require('./utils/logger');

// Import des routes
const authRoutes = require('./routes/auth.routes');
const publicRoutes = require('./routes/public.routes');
const adminRoutes = require('./routes/admin.routes');
const uploadRoutes = require('./routes/upload.routes');

// Import middleware
const errorHandler = require('./middleware/errorHandler');

const app = express();

// =====================================================
// REDIS CLIENT (pour les sessions en production)
// =====================================================
let redisClient = null;
let sessionStore = null;

if (config.isProduction) {
  redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });

  redisClient.connect().catch((err) => {
    logger.error('Erreur connexion Redis:', err.message);
    logger.warn('Fallback sur MemoryStore (non recommandé en production)');
  });

  redisClient.on('error', (err) => logger.error('Redis Client Error:', err));
  redisClient.on('connect', () => logger.info('✅ Redis connecté'));

  sessionStore = new RedisStore({ client: redisClient });
}

// =====================================================
// SÉCURITÉ - HELMET (Headers HTTP sécurisés)
// =====================================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// =====================================================
// SÉCURITÉ - CORS
// =====================================================
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'];
    // Autoriser les requêtes sans origine (same-origin, curl, mobile apps, reverse proxy local)
    // C'est sécurisé car les navigateurs envoient toujours l'origine pour les requêtes cross-origin
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Non autorisé par CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count'],
  maxAge: 86400 // 24 heures
};
app.use(cors(corsOptions));

// =====================================================
// SÉCURITÉ - RATE LIMITING (Anti-DDoS)
// =====================================================

// Rate limit général pour les routes publiques (plus permissif)
const publicLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 500, // 500 requêtes / 15 min
  message: { error: 'Trop de requêtes, réessayez plus tard.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip en développement local
    if (req.ip === '127.0.0.1' && process.env.NODE_ENV === 'development') return true;
    // Skip pour les routes admin (elles ont leur propre limite basée sur le token)
    if (req.path.startsWith('/admin')) return true;
    return false;
  }
});
app.use('/api', publicLimiter);

// Rate limit pour les routes admin (plus permissif car authentifié)
const adminLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200, // 200 requêtes / minute pour les admins
  message: { error: 'Trop de requêtes admin, patientez quelques secondes.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Utilise le token comme clé si disponible, sinon l'IP
    const token = req.headers.authorization?.split(' ')[1];
    return token || req.ip;
  }
});
app.use('/api/admin', adminLimiter);

// Rate limit strict pour l'authentification (anti-bruteforce)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 tentatives / 15 min
  message: { error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' }
});
app.use('/api/auth/login', authLimiter);

// =====================================================
// SÉCURITÉ - Protection XSS & HPP
// =====================================================
app.use(xss()); // Nettoie les données des attaques XSS
app.use(hpp()); // Prévient la pollution des paramètres HTTP

// =====================================================
// PARSING & COMPRESSION
// =====================================================
app.use(express.json({ limit: '10kb' })); // Limite la taille du body
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());
app.use(compression()); // Compression GZIP

// =====================================================
// SESSION (avec Redis en production)
// =====================================================
app.set('trust proxy', 1); // Important derrière Nginx

const sessionConfig = {
  secret: config.session.secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.session.cookieSecure,
    httpOnly: true,
    maxAge: config.session.maxAge,
    sameSite: 'lax'
  }
};

// Utiliser Redis en production si disponible
if (sessionStore) {
  sessionConfig.store = sessionStore;
  logger.info('📦 Sessions stockées dans Redis');
}

app.use(session(sessionConfig));

// =====================================================
// LOGGING
// =====================================================
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) }
  }));
}

// =====================================================
// FICHIERS STATIQUES (avec gestion du cache optimisée)
// =====================================================

// Middleware pour désactiver le cache sur les fichiers HTML
const noCacheForHtml = (req, res, next) => {
  if (req.path.endsWith('.html') || req.path === '/' || !req.path.includes('.')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
};

// Middleware pour forcer la revalidation des JS/CSS (cache avec revalidation)
const revalidateCacheForAssets = (req, res, next) => {
  if (req.path.endsWith('.js') || req.path.endsWith('.css')) {
    // Cache mais doit toujours revalider (ETag sera utilisé)
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  }
  next();
};

app.use(noCacheForHtml);
app.use(revalidateCacheForAssets);

app.use(express.static(path.join(__dirname, '../public'), {
  etag: true,
  lastModified: true,
  // Images et fonts: cache long (7 jours), JS/CSS: géré par le middleware
  setHeaders: (res, filePath) => {
    if (filePath.match(/\.(jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 jours
    }
  }
}));

// Serve assets folder (logo, images, etc.)
app.use('/assets', express.static(path.join(__dirname, '../assets'), {
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // Images: cache long avec revalidation
    res.setHeader('Cache-Control', 'public, max-age=604800, must-revalidate'); // 7 jours
  }
}));

// Servir les assets (images, etc.)
app.use('/assets', express.static(path.join(__dirname, '../assets'), {
  maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
  etag: true
}));

// =====================================================
// ROUTES API
// =====================================================

// Middleware pour désactiver le cache sur toutes les réponses API
// Ceci empêche le navigateur de mettre en cache les données sensibles
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// =====================================================
// ROUTES FRONTEND (SPA)
// =====================================================
app.get('*', (req, res) => {
  // Désactiver le cache pour toutes les pages HTML (SPA)
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// =====================================================
// GESTION DES ERREURS
// =====================================================
app.use(errorHandler);

module.exports = app;
