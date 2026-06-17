/**
 * Service licences compte v1 — gestion des licences liées à un compte.
 * Scénario 3 : ajout d'une licence (soi-même ou enfant) après vérification.
 */

const { AppError } = require('../../../middleware/errorHandler');
const License = require('../../../models/License');
const AccountLicense = require('../../../models/AccountLicense');

const licensesService = {
  /**
   * Licences liées au compte (avec licence + équipe éventuelle).
   */
  async listForUser(userId) {
    return AccountLicense.listByUser(userId);
  },

  /**
   * Vérifie (numéro + date de naissance) puis lie une licence au compte.
   * relationship: 'self' (soi-même) | 'parent' (enfant mineur).
   */
  async linkLicense(userId, { license_number, birth_date, relationship = 'self' }) {
    const birth = new Date(birth_date).toISOString().slice(0, 10);
    const license = await License.findActiveByNumeroAndBirthdate(license_number, birth);
    if (!license) {
      throw new AppError('Aucune licence active ne correspond à ce numéro et cette date de naissance.', 400);
    }

    // Déjà liée à CE compte ?
    if (await AccountLicense.findByUserAndLicense(userId, license.id)) {
      throw new AppError('Cette licence est déjà liée à votre compte.', 409);
    }

    // Règle P5 : une licence 'self' ne peut appartenir qu'à un seul compte.
    // (Plusieurs parents peuvent en revanche partager une licence enfant.)
    if (relationship === 'self' && await AccountLicense.isClaimedAsSelf(license.id, userId)) {
      throw new AppError('Cette licence est déjà rattachée à un autre compte.', 409);
    }

    const linkId = await AccountLicense.link({ userId, licenseId: license.id, relationship });
    return { link_id: linkId, license, relationship };
  },

  /**
   * Supprime la liaison (pas la licence).
   */
  async unlinkLicense(userId, licenseId) {
    const link = await AccountLicense.findByUserAndLicense(userId, licenseId);
    if (!link) {
      throw new AppError('Licence non liée à ce compte.', 404);
    }
    await AccountLicense.unlink(link.id, userId);
    return { unlinked: true };
  },

  /**
   * Définit la licence principale du compte.
   */
  async setPrimary(userId, licenseId) {
    const link = await AccountLicense.findByUserAndLicense(userId, licenseId);
    if (!link) {
      throw new AppError('Licence non liée à ce compte.', 404);
    }
    await AccountLicense.setPrimary(link.id, userId);
    return { is_primary: true, license_id: Number(licenseId) };
  }
};

module.exports = licensesService;
