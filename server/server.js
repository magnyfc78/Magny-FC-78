/**
 * MAGNY FC 78 - Serveur Node.js
 */

require('dotenv').config();

const app = require('./app');
const db = require('./config/database');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

// Gestion des erreurs non capturées
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! Arrêt du serveur...');
  logger.error(err.name, err.message);
  process.exit(1);
});

// Démarrage du serveur
const startServer = async () => {
  try {
    // Test connexion base de données
    await db.testConnection();
    logger.info('✅ Connexion MySQL établie');

    // Démarrage du serveur HTTP
    const server = app.listen(PORT, HOST, () => {
      logger.info(`🚀 Serveur démarré sur http://${HOST}:${PORT}`);
      logger.info(`📦 Mode: ${process.env.NODE_ENV || 'development'}`);
    });

    // Gestion des promesses rejetées
    process.on('unhandledRejection', (err) => {
      logger.error('UNHANDLED REJECTION! Arrêt du serveur...');
      logger.error(err.name, err.message);
      server.close(() => process.exit(1));
    });

    // Arrêt gracieux
    process.on('SIGTERM', () => {
      logger.info('SIGTERM reçu. Arrêt gracieux...');
      server.close(() => {
        logger.info('Processus terminé.');
        db.pool.end();
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Erreur démarrage serveur:', error);
    process.exit(1);
  }
};

startServer();
