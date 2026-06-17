/**
 * Controller compte v1 — historique, export RGPD, suppression.
 */

const accountService = require('./account.service');

const accountController = {
  async loginHistory(req, res, next) {
    try {
      const history = await accountService.getLoginHistory(req.user.id, req.query.limit);
      res.json({ success: true, data: { login_history: history } });
    } catch (err) { next(err); }
  },

  async exportData(req, res, next) {
    try {
      const data = await accountService.exportData(req.user.id);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="mes-donnees-magnyfc78.json"');
      res.send(JSON.stringify({ success: true, data }, null, 2));
    } catch (err) { next(err); }
  },

  async deleteAccount(req, res, next) {
    try {
      await accountService.deleteAccount(req.user.id, req.body.password);
      res.json({ success: true, message: 'Votre compte a été supprimé.' });
    } catch (err) { next(err); }
  }
};

module.exports = accountController;
