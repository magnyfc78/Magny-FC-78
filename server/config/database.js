/**
 * Configuration et connexion sécurisée à MySQL
 * Utilise mysql2 avec requêtes préparées (anti SQL injection)
 */

const mysql = require('mysql2/promise');
const config = require('./index');
const logger = require('../utils/logger');

// Configuration du pool de connexions
const poolConfig = {
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.name,
  
  // Pool de connexions
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0,
  
  // Sécurité
  multipleStatements: false, // Prévient les injections SQL multiples
  charset: 'utf8mb4',
  timezone: '+01:00', // Format numérique pour MySQL2
  
  // Reconnexion automatique
  enableKeepAlive: true,
  keepAliveInitialDelay: 30000
};

// Création du pool
const pool = mysql.createPool(poolConfig);

// Test de connexion
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    logger.info(`MySQL connecté à ${poolConfig.host}:${poolConfig.port}/${poolConfig.database}`);
    connection.release();
    return true;
  } catch (error) {
    logger.error('Erreur connexion MySQL:', error.message);
    throw error;
  }
};

// Wrapper pour les requêtes avec gestion d'erreurs
// Utilise pool.query() au lieu de pool.execute() pour éviter les problèmes
// de prepared statements avec LIMIT/OFFSET dans certaines versions MySQL/MariaDB
const query = async (sql, params = []) => {
  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (error) {
    logger.error('Erreur requête SQL:', error.message);
    logger.error('SQL:', sql);
    throw error;
  }
};

// Transaction helper
const transaction = async (callback) => {
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  
  try {
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  pool,
  query,
  transaction,
  testConnection
};
