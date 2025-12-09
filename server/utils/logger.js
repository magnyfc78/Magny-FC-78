/**
 * Logger sécurisé avec Winston
 * Ne log pas d'informations sensibles
 */

const winston = require('winston');
const path = require('path');

// Format personnalisé
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;
  })
);

// Configuration des transports
const transports = [
  // Console (toujours)
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      customFormat
    )
  })
];

// Fichiers de log en production
if (process.env.NODE_ENV === 'production') {
  transports.push(
    // Logs d'erreurs
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
      format: customFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Tous les logs
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/combined.log'),
      format: customFormat,
      maxsize: 5242880,
      maxFiles: 5
    })
  );
}

// Création du logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  transports,
  // Ne pas crasher sur les erreurs de logging
  exitOnError: false
});

// Fonction pour sanitizer les données sensibles
const sanitize = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sensitiveFields = ['password', 'token', 'jwt', 'secret', 'authorization'];
  const sanitized = { ...obj };
  
  for (const key of Object.keys(sanitized)) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
      sanitized[key] = '[HIDDEN]';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitize(sanitized[key]);
    }
  }
  
  return sanitized;
};

// Export avec sanitization
module.exports = {
  info: (message, meta) => logger.info(message, sanitize(meta)),
  error: (message, meta) => logger.error(message, sanitize(meta)),
  warn: (message, meta) => logger.warn(message, sanitize(meta)),
  debug: (message, meta) => logger.debug(message, sanitize(meta)),
  sanitize
};
