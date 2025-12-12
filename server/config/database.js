/**
 * Configuration et connexion sécurisée à MySQL
 * Utilise mysql2 avec requêtes préparées (anti SQL injection)
 */

const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

// Configuration du pool de connexions
const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'magny_fc_78',
  
  // Pool de connexions
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0,
  
  // Sécurité
  multipleStatements: false, // Prévient les injections SQL multiples
  charset: 'utf8mb4',
  timezone: 'Europe/Paris',
  
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
