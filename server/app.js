/**
 * MAGNY FC 78 - Configuration Express avec sécurité maximale
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const xss = require('xss-clean');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const path = require('path');
const config = require('./config');

// Import des routes
const authRoutes = require('./routes/auth.routes');
const publicRoutes = require('./routes/public.routes');
const adminRoutes = require('./routes/admin.routes');
const uploadRoutes = require('./routes/upload.routes');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();

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
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { error: 'Trop de requêtes, réessayez plus tard.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.ip === '127.0.0.1' && process.env.NODE_ENV === 'development'
});
app.use('/api', limiter);

// Rate limit plus strict pour l'authentification
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 5, // 5 tentatives
  message: { error: 'Trop de tentatives de connexion. Réessayez dans 1 heure.' }
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
// SESSION
// =====================================================
app.set('trust proxy', 1); // Important derrière Nginx

app.use(session({
  secret: config.session.secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.session.cookieSecure,
    httpOnly: true,
    maxAge: config.session.maxAge
  }
}));

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
// FICHIERS STATIQUES
// =====================================================
app.use(express.static(path.join(__dirname, '../public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  etag: true
}));

// Serve assets folder (logo, images, etc.)
app.use('/assets', express.static(path.join(__dirname, '../assets'), {
  maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
  etag: true
}));

// =====================================================
// ROUTES API
// =====================================================
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
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// =====================================================
// GESTION DES ERREURS
// =====================================================
app.use(errorHandler);

module.exports = app;
