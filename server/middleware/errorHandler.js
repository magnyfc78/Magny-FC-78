/**
 * Gestionnaire d'erreurs global
 * Ne révèle pas d'informations sensibles en production
 */

const logger = require('../utils/logger');

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Erreurs spécifiques MySQL
const handleDuplicateError = (err) => {
  const match = err.message.match(/Duplicate entry '(.*)' for key/);
  const value = match ? match[1] : 'valeur';
  return new AppError(`La valeur '${value}' existe déjà.`, 400);
};

const handleValidationError = (err) => {
  return new AppError('Données invalides.', 400);
};

const handleJWTError = () => {
  return new AppError('Token invalide. Veuillez vous reconnecter.', 401);
};

const handleJWTExpiredError = () => {
  return new AppError('Session expirée. Veuillez vous reconnecter.', 401);
};

// Réponse d'erreur en développement (détaillée)
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    success: false,
    error: err.message,
    stack: err.stack,
    details: err
  });
};

// Réponse d'erreur en production (sécurisée)
const sendErrorProd = (err, res) => {
  // Erreur opérationnelle (connue) : envoyer le message
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message
    });
  } 
  // Erreur de programmation : ne pas révéler les détails
  else {
    logger.error('ERREUR:', err);
    res.status(500).json({
      success: false,
      error: 'Une erreur est survenue. Veuillez réessayer.'
    });
  }
};

// Middleware principal
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log de l'erreur
  logger.error(`${err.statusCode} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = { ...err };
    error.message = err.message;

    // Gestion des erreurs spécifiques
    if (err.code === 'ER_DUP_ENTRY') error = handleDuplicateError(err);
    if (err.code === 'ER_BAD_FIELD_ERROR') error = handleValidationError(err);
    if (err.name === 'JsonWebTokenError') error = handleJWTError();
    if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, res);
  }
};

module.exports = errorHandler;
module.exports.AppError = AppError;
