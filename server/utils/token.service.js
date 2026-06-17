/**
 * Génération de tokens & codes sécurisés
 * - Tokens longs (vérification email, reset mot de passe) : aléatoire hex
 * - Codes courts (invitations) : alphanumérique lisible
 */

const crypto = require('crypto');

// Alphabet sans caractères ambigus (0/O, 1/I/L) pour les codes lus par un humain.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Token aléatoire (URL-safe via hex) pour les liens email.
 * @param {number} bytes Nombre d'octets d'entropie (32 -> 64 caractères hex).
 */
const generateToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

/**
 * Code court d'invitation (ex. "K7P2QM9X"). Lisible, sans ambiguïté.
 * @param {number} length Longueur du code.
 */
const generateCode = (length = 8) => {
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
};

/**
 * Date d'expiration à partir de maintenant.
 * @param {number} hours Durée de validité en heures.
 * @returns {Date}
 */
const expiresInHours = (hours) => new Date(Date.now() + hours * 60 * 60 * 1000);

/**
 * Hash SHA-256 (si on souhaite stocker un token hashé plutôt qu'en clair).
 */
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

module.exports = {
  generateToken,
  generateCode,
  expiresInHours,
  hashToken
};
