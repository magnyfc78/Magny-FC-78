/**
 * Service compte v1 — actions self-service : historique de connexions,
 * export RGPD des données, suppression de compte (P5).
 */

const bcrypt = require('bcryptjs');
const { AppError } = require('../../../middleware/errorHandler');
const Account = require('../../../models/Account');
const AccountLicense = require('../../../models/AccountLicense');
const LoginHistory = require('../../../models/LoginHistory');

const accountService = {
  async getLoginHistory(userId, limit) {
    return LoginHistory.listByUser(userId, limit);
  },

  /**
   * Export RGPD : toutes les données personnelles du compte.
   */
  async exportData(userId) {
    const account = await Account.findById(userId);
    if (!account) throw new AppError('Compte introuvable.', 404);
    const [licenses, loginHistory] = await Promise.all([
      AccountLicense.listByUser(userId),
      LoginHistory.listByUser(userId, 200)
    ]);
    return {
      generated_for: account.email,
      account,
      licenses,
      login_history: loginHistory
    };
  },

  /**
   * Suppression RGPD (soft-delete + anonymisation). Confirmation par mot de passe.
   */
  async deleteAccount(userId, password) {
    const hash = await Account.getPasswordHash(userId);
    if (!hash) throw new AppError('Compte introuvable.', 404);

    const valid = await bcrypt.compare(password, hash);
    if (!valid) throw new AppError('Mot de passe incorrect.', 401);

    await Account.softDelete(userId);
    return { deleted: true };
  }
};

module.exports = accountService;
