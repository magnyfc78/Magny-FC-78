/**
 * Utilitaires de gestion sécurisée des mots de passe
 * Utilise bcrypt pour le hashage et la vérification
 */

const bcrypt = require('bcryptjs');
const config = require('../config');

/**
 * Hash un mot de passe en clair
 * @param {string} plainPassword - Mot de passe en clair
 * @returns {Promise<string>} - Mot de passe hashé
 * @example
 * const hashedPassword = await hashPassword('monMotDePasse123');
 * // Stockez hashedPassword dans la base de données
 */
const hashPassword = async (plainPassword) => {
  if (!plainPassword || typeof plainPassword !== 'string') {
    throw new Error('Le mot de passe est requis et doit être une chaîne');
  }

  if (plainPassword.length < 8) {
    throw new Error('Le mot de passe doit contenir au moins 8 caractères');
  }

  const rounds = config.security.bcryptRounds;
  const salt = await bcrypt.genSalt(rounds);
  return bcrypt.hash(plainPassword, salt);
};

/**
 * Vérifie si un mot de passe correspond au hash stocké
 * @param {string} plainPassword - Mot de passe en clair à vérifier
 * @param {string} hashedPassword - Hash stocké en base de données
 * @returns {Promise<boolean>} - true si le mot de passe est correct
 * @example
 * const isValid = await verifyPassword('monMotDePasse123', user.password);
 * if (!isValid) throw new Error('Mot de passe incorrect');
 */
const verifyPassword = async (plainPassword, hashedPassword) => {
  if (!plainPassword || !hashedPassword) {
    return false;
  }

  return bcrypt.compare(plainPassword, hashedPassword);
};

module.exports = {
  hashPassword,
  verifyPassword
};
